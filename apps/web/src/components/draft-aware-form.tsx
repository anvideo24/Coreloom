"use client";

import { createContext, Fragment, useContext, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import {
  clearFormDraft,
  formDataToDraftFields,
  readFormDraft,
  writeFormDraft,
} from "@/lib/domain/form-draft";
import {
  clearFormSubmissionAttempt,
  digestSubmissionSnapshot,
  readFormSubmissionAttempt,
  snapshotSubmissionFields,
  writeFormSubmissionAttempt,
} from "@/lib/domain/form-submission-attempt";
import { createSubmissionId } from "@/lib/domain/submission-dedupe";
import { parseSubmissionId } from "@/lib/domain/submission-id";
import styles from "./draft-aware-form.module.css";

type SubmissionRecoveryNotice = {
  kind: "not-sent" | "uncertain" | "changed";
  title: string;
  description: string;
};

const SUBMISSION_NOT_SENT_NOTICE: SubmissionRecoveryNotice = {
  kind: "not-sent",
  title: "저장 요청을 보내지 못했습니다",
  description: "중복 저장을 막는 정보를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};
const SUBMISSION_UNCERTAIN_NOTICE: SubmissionRecoveryNotice = {
  kind: "uncertain",
  title: "저장 여부를 확인해 주세요",
  description: "저장 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도하거나 견적 목록에서 저장 여부를 확인해 주세요.",
};
const SUBMISSION_CHANGED_NOTICE: SubmissionRecoveryNotice = {
  kind: "changed",
  title: "저장 내용을 확인해 주세요",
  description: "이전 요청과 내용이 달라 다시 보내지 않았습니다. 견적 목록에서 저장 여부를 먼저 확인해 주세요.",
};

type DraftAwareFormProps = {
  scopeId: string;
  formId: string;
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  draftIgnoreFields?: string[];
  persistentSubmissionFields?: readonly string[];
  submissionRecoveryHref?: string;
  children: React.ReactNode;
};

/**
 * 폼 안 어디서나(예: 초안 버리기 버튼) "지금 초안이 실제로 남아 있나"와 "버리기"를 쓸 수
 * 있게 하는 통로(F02-02). `DraftAwareForm`의 `<form>` 밑에 렌더되는 컴포넌트만 값을 받는다.
 */
type DraftFormContextValue = {
  hasDraft: boolean;
  discardDraft: () => void;
};

const DraftFormContext = createContext<DraftFormContextValue | null>(null);
const NO_DRAFT_IGNORES: string[] = [];

/** `DraftAwareForm` 밖에서 쓰면 null — 호출부가 조용히 아무것도 렌더하지 않게 한다. */
export function useDraftFormContext() {
  return useContext(DraftFormContext);
}

function browserDraftStorage() {
  return window.sessionStorage;
}

/**
 * React가 controlled 값으로 관리하는 input/textarea/select는 `element.value = ...`만으로
 * 되돌리면 화면에 잠깐 보였다가 다음 리렌더에서 원래 state 값으로 되돌아간다(React가 값을
 * 추적하는 setter를 인스턴스에 심어 두기 때문). 원본 프로토타입의 setter로 값을 넣고 실제
 * input/change 이벤트를 보내야 그 필드의 onChange가 실제로 불려 컴포넌트 state까지 갱신된다.
 * uncontrolled 필드(예: defaultValue만 쓰는 입력)에도 부작용 없이 동작한다.
 */
function setControlledValue(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : field instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (nativeSetter) nativeSetter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyFieldToElement(element: Element | RadioNodeList, value: string) {
  if (element instanceof RadioNodeList) {
    for (const node of Array.from(element)) {
      const field = node as Element;
      if (field instanceof HTMLInputElement && field.type === "checkbox") {
        field.checked = value === "on" || value === "true" || value === field.value;
      } else if (field instanceof HTMLInputElement && field.type === "radio") {
        field.checked = field.value === value;
      } else if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        setControlledValue(field, value);
      }
    }
    return;
  }
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") {
      element.checked = value === "on" || value === "true" || value === element.value;
    } else if (element.type === "radio") {
      element.checked = element.value === value;
    } else {
      setControlledValue(element, value);
    }
    return;
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    setControlledValue(element, value);
  }
}

/** 작성 패널 폼 초안을 sessionStorage에 보존한다. 본문은 로그하지 않는다. */
export function DraftAwareForm({
  scopeId,
  formId,
  action,
  className,
  draftIgnoreFields = NO_DRAFT_IGNORES,
  persistentSubmissionFields,
  submissionRecoveryHref,
  children,
}: DraftAwareFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const restoredRef = useRef(false);
  const restoringRef = useRef(false);
  // 일반 폼은 열린 창 안에서 식별자를 재사용한다. persistentSubmissionFields를 지정한 신규 견적은
  // 아래 사전검사에서 UUID와 payload 해시를 먼저 저장해, 재열기 뒤 같은 저장 시도도 이어 간다.
  const submissionIdRef = useRef(createSubmissionId());
  const submissionPreflightRef = useRef<{ payloadSnapshot: string } | null>(null);
  const submissionPreflightBusyRef = useRef(false);
  const submissionPreflightGenerationRef = useRef(0);
  const submissionActionBusyRef = useRef(false);
  const recoveryNoticeRef = useRef<HTMLDivElement>(null);
  const [submissionRecoveryNotice, setSubmissionRecoveryNotice] = useState<SubmissionRecoveryNotice | null>(null);
  const [submissionInFlight, setSubmissionInFlight] = useState(false);
  const [, startSubmissionTransition] = useTransition();
  // 초안이 실제로 남아 있을 때만 버리기 버튼을 보여주기 위한 상태(F02-02).
  const [hasDraft, setHasDraft] = useState(false);
  // 버리기를 누르면 이 값을 올려 children을 통째로 새로 mount한다 — 제어/비제어 입력,
  // 탭 뒤에 숨은 필드까지 각자의 초기값(대개 빈 값)으로 한 번에 돌아간다. 복원과 반대 방향의
  // 손질 코드를 따로 만들면 둘이 나중에 어긋난다.
  const [fieldsResetKey, setFieldsResetKey] = useState(0);

  useEffect(() => {
    const form = formRef.current;
    if (!form || restoredRef.current) return;
    restoredRef.current = true;

    let fields: Record<string, string> | null = null;
    let hasSubmissionAttempt = false;
    try {
      fields = readFormDraft(browserDraftStorage(), scopeId, formId)?.fields ?? null;
    } catch {
      /* sessionStorage 접근 불가는 초안 없음과 같다. */
    }
    if (persistentSubmissionFields) {
      try {
        hasSubmissionAttempt = !!readFormSubmissionAttempt(browserDraftStorage(), scopeId, formId);
      } catch {
        // 손상됐거나 읽을 수 없는 식별자도 전송은 아래 사전검사에서 막는다.
      }
    }
    if (hasSubmissionAttempt) setSubmissionRecoveryNotice(SUBMISSION_UNCERTAIN_NOTICE);
    if (!fields || Object.keys(fields).length === 0) {
      setHasDraft(hasSubmissionAttempt);
      return;
    }
    setHasDraft(true);

    const pending = new Set(Object.keys(fields));
    let observer: MutationObserver | null = null;

    function attemptRestore() {
      restoringRef.current = true;
      for (const name of Array.from(pending)) {
        if (!pending.has(name)) continue;
        if (draftIgnoreFields.includes(name)) {
          pending.delete(name);
          continue;
        }
        // 화면에 보이는 칸을 먼저 찾는다. 제출값을 나르는 hidden과 이름이 겹치지 않게
        // 복원 전용 표식을 쓴다 — 같은 name을 두 번 달면 FormData에 값이 두 개 들어가고,
        // 나중에 누가 Object.fromEntries로 읽는 순간 조용히 다른 값이 저장된다.
        const markedElement = form!.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          `[data-draft-field="${CSS.escape(name)}"]`,
        );
        const namedElement = form!.elements.namedItem(name);
        // A hidden submission mirror may be mounted before its visible editor
        // (for example the note textarea in the internal tab). Leave that field
        // pending until the marked editor appears.
        const element =
          markedElement ??
          (namedElement instanceof HTMLInputElement && namedElement.type === "hidden"
            ? null
            : namedElement);
        if (!element) continue;
        try {
          applyFieldToElement(element, fields![name]);
        } catch {
          /* 필드 하나 복원 실패가 나머지 복원을 막지 않는다 */
        }
        pending.delete(name);
        if (element instanceof Element) {
          const supersededPrefix = element.getAttribute("data-draft-supersedes-prefix");
          if (supersededPrefix) {
            for (const pendingName of Array.from(pending)) {
              if (pendingName.startsWith(supersededPrefix)) pending.delete(pendingName);
            }
          }
        }
      }
      restoringRef.current = false;
      if (pending.size === 0) observer?.disconnect();
    }

    attemptRestore();
    // 탭·아코디언처럼 나중에 나타나는 필드(예: 견적 품목 편집기는 "내부 원가" 탭에서만 DOM에 붙는다)를
    // 놓치지 않도록, 아직 못 찾은 필드가 있으면 폼의 DOM 변화를 계속 지켜보다 나타나는 순간 채운다.
    if (pending.size > 0) {
      observer = new MutationObserver(attemptRestore);
      observer.observe(form, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, [scopeId, formId, draftIgnoreFields, persistentSubmissionFields]);

  useEffect(
    () => () => {
      submissionPreflightGenerationRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!submissionRecoveryNotice) return;
    const notice = recoveryNoticeRef.current;
    notice?.focus();
    notice?.scrollIntoView?.({ block: "nearest" });
  }, [submissionRecoveryNotice]);

  function persist() {
    if (restoringRef.current) return;
    const form = formRef.current;
    if (!form) return;
    try {
      const fields = formDataToDraftFields(new FormData(form));
      // Some editors intentionally omit `name` so their visible control does not
      // duplicate a submission-only hidden field. Include those controls in the
      // draft snapshot by their explicit restore marker instead.
      for (const element of Array.from(form.querySelectorAll<HTMLElement>("[data-draft-field]"))) {
        const name = element.getAttribute("data-draft-field");
        if (!name) continue;
        if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          fields[name] = element.checked ? element.value : "";
        } else if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          fields[name] = element.value;
        }
      }
      const written = writeFormDraft(browserDraftStorage(), {
        scopeId,
        formId,
        fields,
      });
      // 다 지우면 writeFormDraft가 스스로 저장소를 비우고 null을 돌려준다 — 그 순간 곧바로
      // 버리기 버튼도 사라져야 "늘 떠 있어 시끄러운" 상태를 피한다.
      setHasDraft(!!written);
    } catch {
      /* 비공개 모드 등 */
    }
  }

  function discardDraft() {
    if (submissionActionBusyRef.current) return;
    submissionPreflightGenerationRef.current += 1;
    submissionPreflightRef.current = null;
    submissionPreflightBusyRef.current = false;
    submissionActionBusyRef.current = false;
    setSubmissionRecoveryNotice(null);
    try {
      clearFormDraft(browserDraftStorage(), scopeId, formId);
      if (persistentSubmissionFields) clearFormSubmissionAttempt(browserDraftStorage(), scopeId, formId);
    } catch {
      /* 비공개 모드 등 — 지울 저장소가 없으면 지운 것과 같다. */
    }
    setHasDraft(false);
    setFieldsResetKey((key) => key + 1);
  }

  async function preparePersistentSubmission(event: FormEvent<HTMLFormElement>) {
    if (!persistentSubmissionFields) return;
    if (submissionActionBusyRef.current) {
      event.preventDefault();
      return;
    }
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(form);
    let payloadSnapshot: string;

    try {
      payloadSnapshot = snapshotSubmissionFields(formData, persistentSubmissionFields);
    } catch {
      event.preventDefault();
      setSubmissionRecoveryNotice(SUBMISSION_NOT_SENT_NOTICE);
      return;
    }

    const preflight = submissionPreflightRef.current;
    if (preflight?.payloadSnapshot === payloadSnapshot) {
      event.preventDefault();
      submissionPreflightRef.current = null;
      submissionActionBusyRef.current = true;
      setSubmissionInFlight(true);
      startSubmissionTransition(() => runFormAction(formData));
      return;
    }
    if (preflight) {
      submissionPreflightRef.current = null;
    }
    if (submissionPreflightBusyRef.current) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setSubmissionRecoveryNotice(null);
    submissionPreflightBusyRef.current = true;
    const preflightGeneration = ++submissionPreflightGenerationRef.current;

    try {
      const payloadDigest = await digestSubmissionSnapshot(payloadSnapshot);
      if (preflightGeneration !== submissionPreflightGenerationRef.current || !form.isConnected) return;
      const storage = browserDraftStorage();
      const pending = readFormSubmissionAttempt(storage, scopeId, formId);
      if (pending && pending.payloadDigest !== payloadDigest) {
        setSubmissionRecoveryNotice(SUBMISSION_CHANGED_NOTICE);
        return;
      }

      const submissionId = pending?.submissionId ?? parseSubmissionId(createSubmissionId());
      if (!submissionId) throw new Error("Secure submission id is unavailable");
      if (!pending) {
        writeFormSubmissionAttempt(storage, {
          version: 1,
          scopeId,
          formId,
          submissionId,
          payloadDigest,
        });
      }
      setHasDraft(true);
      submissionIdRef.current = submissionId;
      submissionPreflightRef.current = { payloadSnapshot };
      setSubmissionRecoveryNotice(null);
      form.requestSubmit(submitter instanceof HTMLElement && submitter.isConnected ? submitter : undefined);
    } catch {
      setSubmissionRecoveryNotice(SUBMISSION_NOT_SENT_NOTICE);
    } finally {
      if (preflightGeneration === submissionPreflightGenerationRef.current) {
        submissionPreflightBusyRef.current = false;
      }
    }
  }

  async function runFormAction(formData: FormData) {
    submissionPreflightRef.current = null;
    formData.set("submissionId", submissionIdRef.current);
    try {
      await action(formData);
      // 성공했다. 다음 제출은 다른 시도이니 식별자를 새로 바꾼다.
      submissionIdRef.current = createSubmissionId();
      setSubmissionRecoveryNotice(null);
      try {
        clearFormDraft(browserDraftStorage(), scopeId, formId);
        if (persistentSubmissionFields) clearFormSubmissionAttempt(browserDraftStorage(), scopeId, formId);
        setHasDraft(false);
      } catch {
        /* ignore */
      }
    } catch (error) {
      if (isRedirectError(error)) {
        // 이 앱의 저장 액션은 성공하면 redirect()로 끝난다 — 이것도 성공이다.
        submissionIdRef.current = createSubmissionId();
        setSubmissionRecoveryNotice(null);
        try {
          clearFormDraft(browserDraftStorage(), scopeId, formId);
          if (persistentSubmissionFields) clearFormSubmissionAttempt(browserDraftStorage(), scopeId, formId);
          setHasDraft(false);
        } catch {
          /* ignore */
        }
        throw error;
      }
      if (persistentSubmissionFields) {
        // opt-in 신규 견적은 form action의 정상 반환 경로를 쓰지 않는다. React 19 자동 reset 없이
        // 같은 화면에서 입력과 요청 식별자를 유지한 채 명시적으로 재시도할 수 있게 한다.
        setSubmissionRecoveryNotice(SUBMISSION_UNCERTAIN_NOTICE);
        return;
      }
      throw error;
    } finally {
      if (persistentSubmissionFields) {
        submissionActionBusyRef.current = false;
        setSubmissionInFlight(false);
      }
    }
  }

  return (
    <DraftFormContext.Provider value={{ hasDraft: hasDraft && !submissionInFlight, discardDraft }}>
      <form
        action={runFormAction}
        aria-busy={submissionInFlight}
        className={className}
        onChange={persist}
        onInput={persist}
        onSubmit={(event) => void preparePersistentSubmission(event)}
        ref={formRef}
      >
        {submissionRecoveryNotice ? (
          <div
            aria-atomic="true"
            className={styles.notice}
            ref={recoveryNoticeRef}
            role="alert"
            tabIndex={-1}
          >
            <h2>{submissionRecoveryNotice.title}</h2>
            <p>{submissionRecoveryNotice.description}</p>
            <div className={styles.actions}>
              {submissionRecoveryNotice.kind !== "changed" ? (
                <button className={styles.primaryAction} type="submit">다시 시도</button>
              ) : null}
              {submissionRecoveryHref ? (
                <a className={styles.secondaryAction} href={submissionRecoveryHref}>견적 목록 확인</a>
              ) : null}
            </div>
          </div>
        ) : null}
        <Fragment key={fieldsResetKey}>{children}</Fragment>
      </form>
    </DraftFormContext.Provider>
  );
}
