"use client";

import { useEffect, useRef } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import {
  clearFormDraft,
  formDataToDraftFields,
  readFormDraft,
  writeFormDraft,
} from "@/lib/domain/form-draft";

type DraftAwareFormProps = {
  scopeId: string;
  formId: string;
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
};

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
export function DraftAwareForm({ scopeId, formId, action, className, children }: DraftAwareFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form || restoredRef.current) return;
    restoredRef.current = true;

    let fields: Record<string, string> | null = null;
    try {
      fields = readFormDraft(browserDraftStorage(), scopeId, formId)?.fields ?? null;
    } catch {
      /* sessionStorage 접근 불가는 초안 없음과 같다. */
    }
    if (!fields) return;

    const pending = new Set(Object.keys(fields));
    let observer: MutationObserver | null = null;

    function attemptRestore() {
      for (const name of Array.from(pending)) {
        // 화면에 보이는 칸을 먼저 찾는다. 제출값을 나르는 hidden과 이름이 겹치지 않게
        // 복원 전용 표식을 쓴다 — 같은 name을 두 번 달면 FormData에 값이 두 개 들어가고,
        // 나중에 누가 Object.fromEntries로 읽는 순간 조용히 다른 값이 저장된다.
        const element =
          form!.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            `[data-draft-field="${CSS.escape(name)}"]`,
          ) ?? form!.elements.namedItem(name);
        if (!element) continue;
        try {
          applyFieldToElement(element, fields![name]);
        } catch {
          /* 필드 하나 복원 실패가 나머지 복원을 막지 않는다 */
        }
        pending.delete(name);
      }
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
  }, [scopeId, formId]);

  function persist() {
    const form = formRef.current;
    if (!form) return;
    try {
      writeFormDraft(browserDraftStorage(), {
        scopeId,
        formId,
        fields: formDataToDraftFields(new FormData(form)),
      });
    } catch {
      /* 비공개 모드 등 */
    }
  }

  return (
    <form
      action={async (formData) => {
        try {
          await action(formData);
          try {
            clearFormDraft(browserDraftStorage(), scopeId, formId);
          } catch {
            /* ignore */
          }
        } catch (error) {
          if (isRedirectError(error)) {
            try {
              clearFormDraft(browserDraftStorage(), scopeId, formId);
            } catch {
              /* ignore */
            }
          }
          throw error;
        }
      }}
      className={className}
      onChange={persist}
      onInput={persist}
      ref={formRef}
    >
      {children}
    </form>
  );
}
