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

function applyFieldsToForm(form: HTMLFormElement, fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) {
    const element = form.elements.namedItem(name);
    if (!element) continue;
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
          field.value = value;
        }
      }
      continue;
    }
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox") {
        element.checked = value === "on" || value === "true" || value === element.value;
      } else if (element.type === "radio") {
        element.checked = element.value === value;
      } else {
        element.value = value;
      }
      continue;
    }
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.value = value;
    }
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
    try {
      const draft = readFormDraft(browserDraftStorage(), scopeId, formId);
      if (draft) applyFieldsToForm(form, draft.fields);
    } catch {
      /* sessionStorage 접근 불가는 초안 없음과 같다. */
    }
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
