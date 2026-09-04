"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
  amountFromUnitPrice,
  calculatePackageCostAmount,
  calculateQuoteCosting,
  createEmptyQuotePackage,
  defaultQuoteValidUntil,
  formatQuoteDocumentNumber,
  monthlyRateForRole,
  quoteRoleRates,
  quoteVatModeLabels,
  suggestCustomerSupplyAmount,
  toDateInputValue,
  unitPriceFromAmount,
  type QuotePackage,
  type QuoteVatMode,
} from "@/lib/domain/quotes";
import { quoteIssuerProfile } from "@/lib/quotes/issuer";

export type QuoteComposerContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  clientCompanyId: string;
};

export type QuoteComposerVersion = {
  id: string;
  versionNumber: number;
  title: string;
  totalAmount: number;
  createdAt?: string | Date | null;
  href?: string;
};

type ComposerProps = {
  initialPackages?: QuotePackage[];
  initialVatMode?: QuoteVatMode;
  initialTargetMarginPercent?: number;
  initialOperatingCostPercent?: number;
  initialTitle?: string;
  initialIssuedOn?: string;
  initialValidUntil?: string;
  initialClientContactId?: string;
  initialNote?: string;
  clientId?: string;
  clientName?: string;
  contacts?: QuoteComposerContact[];
  versionNumber?: number;
  versions?: QuoteComposerVersion[];
  note?: string;
  onNoteChange?: (note: string) => void;
  vatMode?: QuoteVatMode;
  onVatModeChange?: (mode: QuoteVatMode) => void;
};

type TabId = "customer" | "internal";

function won(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;
}

function formatWonDigits(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return Math.round(value).toLocaleString("ko-KR");
}

function parseWonDigits(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const number = Number(digits);
  return Number.isFinite(number) ? number : 0;
}

function WonAmountInput({
  value,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: number;
  onValueChange: (value: number) => void;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      autoComplete="off"
      className={className}
      inputMode="numeric"
      onChange={(event) => onValueChange(parseWonDigits(event.target.value))}
      type="text"
      value={formatWonDigits(value)}
    />
  );
}

function rangeProgress(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function PercentRangeInput({
  value,
  min,
  max,
  onValueChange,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
  "aria-label"?: string;
}) {
  const progress = rangeProgress(value, min, max);
  return (
    <input
      aria-label={ariaLabel}
      className="quote-range"
      max={max}
      min={min}
      onChange={(event) => onValueChange(Number(event.target.value))}
      style={{ "--range-progress": `${progress}%` } as CSSProperties}
      type="range"
      value={value}
    />
  );
}

function safeCost(pkg: QuotePackage) {
  try {
    return calculatePackageCostAmount(pkg);
  } catch {
    return 0;
  }
}

function suggestedAmount(pkg: QuotePackage, margin: number, operating: number, vatMode: QuoteVatMode) {
  try {
    const cost = safeCost(pkg);
    const supply = suggestCustomerSupplyAmount(cost, margin, operating);
    return vatMode === "inclusive" ? Math.round(supply * 1.1) : supply;
  } catch {
    return 0;
  }
}

function roleSelectValue(role: string) {
  if (!role) return "";
  if (quoteRoleRates.some((item) => item.role === role)) return role;
  return "__custom__";
}

function formatVersionDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function QuoteCostingComposer({
  initialPackages,
  initialVatMode = "exclusive",
  initialTargetMarginPercent = 30,
  initialOperatingCostPercent = 10,
  initialTitle = "",
  initialIssuedOn,
  initialValidUntil,
  initialClientContactId = "",
  initialNote = "",
  clientId = "",
  clientName = "고객사",
  contacts = [],
  versionNumber = 1,
  versions = [],
  note: controlledNote,
  onNoteChange,
  vatMode: controlledVatMode,
  onVatModeChange,
}: ComposerProps) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const defaultValidUntil = useMemo(() => toDateInputValue(defaultQuoteValidUntil(new Date())), []);

  const [packages, setPackages] = useState<QuotePackage[]>(
    initialPackages?.length ? initialPackages : [createEmptyQuotePackage()],
  );
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
  const [tab, setTab] = useState<TabId>("customer");
  const [title, setTitle] = useState(initialTitle);
  const [localNote, setLocalNote] = useState(initialNote);
  const [localVatMode, setLocalVatMode] = useState<QuoteVatMode>(initialVatMode);
  const [targetMarginPercent, setTargetMarginPercent] = useState(initialTargetMarginPercent);
  const [operatingCostPercent, setOperatingCostPercent] = useState(initialOperatingCostPercent);
  const [issuedOn, setIssuedOn] = useState(initialIssuedOn || today);
  const [validUntil, setValidUntil] = useState(initialValidUntil || defaultValidUntil);
  const [clientContactId, setClientContactId] = useState(initialClientContactId);

  const vatMode = controlledVatMode ?? localVatMode;
  const note = controlledNote ?? localNote;
  const setNote = onNoteChange ?? setLocalNote;

  const setVatMode = (mode: QuoteVatMode) => {
    if (onVatModeChange) onVatModeChange(mode);
    else setLocalVatMode(mode);
  };

  const clientContacts = useMemo(
    () => contacts.filter((contact) => !clientId || contact.clientCompanyId === clientId),
    [contacts, clientId],
  );

  const selectedContact = clientContacts.find((contact) => contact.id === clientContactId) ?? null;

  const livePackages = useMemo(
    () =>
      packages.map((pkg) => {
        const costAmount = safeCost(pkg);
        const suggested = suggestedAmount(pkg, targetMarginPercent, operatingCostPercent, vatMode);
        const amount = pkg.amountLocked && pkg.amount > 0 ? pkg.amount : suggested;
        const quantity = pkg.quantity > 0 ? pkg.quantity : 1;
        return { ...pkg, costAmount, amount, quantity };
      }),
    [packages, targetMarginPercent, operatingCostPercent, vatMode],
  );

  const preview = useMemo(() => {
    try {
      return calculateQuoteCosting({
        packages: livePackages,
        vatMode,
        targetMarginPercent,
        operatingCostPercent,
      });
    } catch {
      const costAmount = livePackages.reduce((sum, item) => sum + item.costAmount, 0);
      const lineSum = livePackages.reduce((sum, item) => sum + (item.amount > 0 ? item.amount : 0), 0);
      const operatingCostAmount = Math.round(costAmount * (operatingCostPercent / 100));
      let subtotalAmount: number;
      let vatAmount: number;
      let totalAmount: number;
      if (vatMode === "inclusive") {
        totalAmount = lineSum;
        subtotalAmount = Math.round(totalAmount / 1.1);
        vatAmount = totalAmount - subtotalAmount;
      } else {
        subtotalAmount = lineSum;
        vatAmount = Math.round(subtotalAmount * 0.1);
        totalAmount = subtotalAmount + vatAmount;
      }
      return {
        costAmount,
        operatingCostAmount,
        marginAmount: Math.max(0, subtotalAmount - costAmount - operatingCostAmount),
        subtotalAmount,
        vatAmount,
        totalAmount,
        customerItems: livePackages.map((item) => ({
          title: item.title || `작업 패키지`,
          customerDescription: item.customerDescription,
          quantity: item.quantity,
          unitPrice: unitPriceFromAmount(item.amount, item.quantity),
          amount: item.amount,
        })),
      };
    }
  }, [livePackages, vatMode, targetMarginPercent, operatingCostPercent]);

  const documentNumber = useMemo(() => {
    try {
      const date = new Date(`${issuedOn}T00:00:00`);
      return formatQuoteDocumentNumber(versionNumber, Number.isNaN(date.getTime()) ? new Date() : date);
    } catch {
      return formatQuoteDocumentNumber(versionNumber);
    }
  }, [issuedOn, versionNumber]);

  const resolvedTitle = title.trim() || (clientName.trim() ? `${clientName.trim()} · 견적` : "제목 없는 견적");

  const updatePackage = (index: number, patch: Partial<QuotePackage>) => {
    setPackages((current) =>
      current.map((pkg, pkgIndex) => (pkgIndex === index ? { ...pkg, ...patch } : pkg)),
    );
  };

  const applyRole = (index: number, role: string) => {
    const rate = monthlyRateForRole(role);
    updatePackage(index, {
      role,
      ...(rate != null ? { monthlyRate: rate, amountLocked: false } : {}),
    });
  };

  const unlockAndSuggest = (index: number) => {
    setPackages((current) =>
      current.map((pkg, pkgIndex) => {
        if (pkgIndex !== index) return pkg;
        const next = { ...pkg, amountLocked: false };
        return { ...next, amount: suggestedAmount(next, targetMarginPercent, operatingCostPercent, vatMode) };
      }),
    );
  };

  const addPackage = () => {
    setPackages((current) => [...current, createEmptyQuotePackage()]);
    setExpanded((current) => ({ ...current, [packages.length]: true }));
  };

  const aside = (
    <aside className="quote-costing-aside" aria-live="polite">
      <div className="quote-costing-live">
        <p className="setup-code">실시간 합계</p>
        {tab === "internal" ? (
          <>
            <p>
              <span>내부 원가</span>
              <strong>{won(preview.costAmount)}</strong>
            </p>
            <p>
              <span>운영비 ({operatingCostPercent}%)</span>
              <strong>{won(preview.operatingCostAmount)}</strong>
            </p>
            <p>
              <span>마진</span>
              <strong>{won(preview.marginAmount)}</strong>
            </p>
          </>
        ) : null}
        <p>
          <span>공급가</span>
          <strong>{won(preview.subtotalAmount)}</strong>
        </p>
        <p>
          <span>부가세</span>
          <strong>{won(preview.vatAmount)}</strong>
        </p>
        <p className="quote-costing-total">
          <span>합계</span>
          <strong>{won(preview.totalAmount)}</strong>
        </p>
      </div>

      <div className="quote-costing-versions">
        <p className="setup-code">버전 이력</p>
        <ul>
          <li className="is-editing">
            <div>
              <strong>v{versionNumber}</strong>
              <span>편집 중</span>
            </div>
            <p>{resolvedTitle}</p>
          </li>
          {versions.map((version) => (
            <li key={version.id}>
              {version.href ? (
                <a href={version.href}>
                  <div>
                    <strong>v{version.versionNumber}</strong>
                    <span>{formatVersionDate(version.createdAt)}</span>
                  </div>
                  <p>{version.title}</p>
                  <p className="quote-version-amount">{won(version.totalAmount)}</p>
                </a>
              ) : (
                <>
                  <div>
                    <strong>v{version.versionNumber}</strong>
                    <span>{formatVersionDate(version.createdAt)}</span>
                  </div>
                  <p>{version.title}</p>
                  <p className="quote-version-amount">{won(version.totalAmount)}</p>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="quote-costing-versions-hint">저장된 버전은 덮어쓰지 않습니다. 보거나 이 버전으로 새 수정본을 만듭니다.</p>
      </div>
    </aside>
  );

  return (
    <div className={`quote-costing ${tab === "customer" ? "is-customer" : "is-internal"}`}>
      <input name="packagesJson" type="hidden" value={JSON.stringify(livePackages)} />
      <input name="targetMarginPercent" type="hidden" value={targetMarginPercent} />
      <input name="operatingCostPercent" type="hidden" value={operatingCostPercent} />
      <input name="title" type="hidden" value={resolvedTitle} />
      <input name="issuedOn" type="hidden" value={issuedOn} />
      <input name="validUntil" type="hidden" value={validUntil} />
      <input name="clientContactId" type="hidden" value={clientContactId} />
      {controlledNote == null ? <input name="note" type="hidden" value={note} /> : null}
      {controlledVatMode == null ? <input name="vatMode" type="hidden" value={vatMode} /> : null}

      <div className="quote-costing-doc-meta">
        <label>
          견적 주제
          <input
            aria-label="견적 주제"
            onChange={(event) => setTitle(event.target.value)}
            placeholder={clientName.trim() ? `${clientName.trim()} · 견적` : "짧은 견적 주제"}
            value={title}
          />
        </label>
        <label>
          담당자
          <select
            aria-label="담당자"
            onChange={(event) => setClientContactId(event.target.value)}
            value={clientContactId}
          >
            <option value="">선택하지 않음</option>
            {clientContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
                {contact.role ? ` · ${contact.role}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          발행일
          <input
            aria-label="발행일"
            onChange={(event) => {
              const next = event.target.value;
              setIssuedOn(next);
              if (!initialValidUntil) {
                try {
                  setValidUntil(toDateInputValue(defaultQuoteValidUntil(new Date(`${next}T00:00:00`))));
                } catch {
                  // keep current validUntil
                }
              }
            }}
            type="date"
            value={issuedOn}
          />
        </label>
        <label>
          유효기간
          <input
            aria-label="유효기간"
            onChange={(event) => setValidUntil(event.target.value)}
            type="date"
            value={validUntil}
          />
        </label>
        <label>
          부가세
          <select
            aria-label="부가세"
            onChange={(event) => setVatMode(event.target.value as QuoteVatMode)}
            value={vatMode}
            {...(controlledVatMode != null ? { name: "vatMode" } : {})}
          >
            <option value="exclusive">미포함 (별도)</option>
            <option value="inclusive">포함</option>
          </select>
        </label>
      </div>

      <div className="quote-costing-toolbar">
        <div className="quote-costing-tabs" role="tablist" aria-label="견적 보기">
          <button
            aria-selected={tab === "customer"}
            className={tab === "customer" ? "is-active" : undefined}
            onClick={() => setTab("customer")}
            role="tab"
            type="button"
          >
            고객용
          </button>
          <button
            aria-selected={tab === "internal"}
            className={tab === "internal" ? "is-active" : undefined}
            onClick={() => setTab("internal")}
            role="tab"
            type="button"
          >
            내부 원가
          </button>
        </div>
      </div>

      <div className="quote-costing-workspace">
        <div className="quote-costing-main">
          {tab === "customer" ? (
            <article className="quote-document quote-document-compose quote-document-invoice">
              <header className="quote-invoice-header">
                <div className="quote-invoice-brand-block">
                  <p className="quote-invoice-title">INVOICE</p>
                  <p className="quote-invoice-lead">아래와 같이 견적드립니다. 검토 후 회신 부탁드립니다.</p>
                </div>
                <div className="quote-invoice-meta">
                  <p className="quote-invoice-brand">{quoteIssuerProfile.brandName}</p>
                  <dl>
                    <div>
                      <dt>견적번호</dt>
                      <dd>{documentNumber}</dd>
                    </div>
                    <div>
                      <dt>발행일</dt>
                      <dd>{issuedOn || "—"}</dd>
                    </div>
                    <div>
                      <dt>유효기간</dt>
                      <dd>{validUntil || "—"}</dd>
                    </div>
                  </dl>
                </div>
              </header>

              <section className="quote-invoice-parties">
                <div>
                  <p className="quote-invoice-label">수신</p>
                  <p className="quote-invoice-client">{clientName || "고객사 선택"}</p>
                  {selectedContact ? (
                    <p className="quote-invoice-muted">담당자 {selectedContact.name}</p>
                  ) : null}
                  <p className="quote-invoice-muted">{resolvedTitle}</p>
                </div>
              </section>

              <table className="quote-invoice-table">
                <thead>
                  <tr>
                    <th className="is-title">항목</th>
                    <th className="is-desc">설명</th>
                    <th className="is-qty">수량</th>
                    <th className="is-unit">단가</th>
                    <th className="is-amount">공급가액</th>
                  </tr>
                </thead>
                <tbody>
                  {livePackages.map((pkg, index) => {
                    const unitPrice = unitPriceFromAmount(pkg.amount, pkg.quantity);
                    return (
                      <tr key={index}>
                        <td className="is-title">
                          <input
                            aria-label={`항목 ${index + 1} 작업명`}
                            className="quote-document-line-title"
                            onChange={(event) => updatePackage(index, { title: event.target.value })}
                            placeholder={`작업 패키지 ${index + 1}`}
                            required
                            value={pkg.title}
                          />
                          {livePackages.length > 1 ? (
                            <button
                              className="quote-item-remove"
                              onClick={() => {
                                setPackages((current) => current.filter((_, pkgIndex) => pkgIndex !== index));
                                setExpanded({});
                              }}
                              type="button"
                            >
                              삭제
                            </button>
                          ) : null}
                        </td>
                        <td className="is-desc">
                          <textarea
                            aria-label={`항목 ${index + 1} 설명`}
                            className="quote-document-line-desc"
                            onChange={(event) =>
                              updatePackage(index, { customerDescription: event.target.value })
                            }
                            placeholder="고객에게 보이는 설명"
                            rows={2}
                            value={pkg.customerDescription}
                          />
                        </td>
                        <td className="is-qty">
                          <input
                            aria-label={`항목 ${index + 1} 수량`}
                            className="quote-document-line-qty"
                            inputMode="numeric"
                            min={1}
                            onChange={(event) => {
                              const quantity = Math.max(1, Math.round(Number(event.target.value) || 1));
                              const nextAmount = amountFromUnitPrice(unitPrice, quantity);
                              updatePackage(index, {
                                quantity,
                                amount: nextAmount,
                                amountLocked: true,
                              });
                            }}
                            type="number"
                            value={pkg.quantity}
                          />
                        </td>
                        <td className="is-unit">
                          <WonAmountInput
                            aria-label={`항목 ${index + 1} 단가`}
                            className="quote-document-line-unit"
                            onValueChange={(nextUnit) => {
                              const quantity = pkg.quantity > 0 ? pkg.quantity : 1;
                              updatePackage(index, {
                                amount: amountFromUnitPrice(nextUnit, quantity),
                                amountLocked: true,
                              });
                            }}
                            value={unitPrice}
                          />
                        </td>
                        <td className="is-amount">
                          <WonAmountInput
                            aria-label={`항목 ${index + 1} 공급가액`}
                            className="quote-document-line-amount"
                            onValueChange={(amount) => updatePackage(index, { amount, amountLocked: true })}
                            value={pkg.amount}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <button className="text-link quote-item-add" onClick={addPackage} type="button">
                항목 추가
              </button>

              <section className="quote-invoice-summary">
                <div className="quote-invoice-note-block">
                  <p>상기 금액은 {quoteVatModeLabels[vatMode]}입니다.</p>
                  <label className="quote-document-note">
                    메모 (선택)
                    <textarea
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="견적 조건이나 전달 메모"
                      value={note}
                    />
                  </label>
                </div>
                <div className="quote-totals">
                  <p>
                    <span>공급가액</span>
                    <strong>{won(preview.subtotalAmount)}</strong>
                  </p>
                  <p>
                    <span>부가세</span>
                    <strong>{won(preview.vatAmount)}</strong>
                  </p>
                  <p className="quote-total">
                    <span>합계</span>
                    <strong>{won(preview.totalAmount)}</strong>
                  </p>
                </div>
              </section>

              <footer className="quote-invoice-footer">
                <div>
                  <p className="quote-invoice-label">입금 안내</p>
                  <dl className="quote-invoice-footer-list">
                    <div>
                      <dt>은행</dt>
                      <dd>{quoteIssuerProfile.bankName || "—"}</dd>
                    </div>
                    <div>
                      <dt>계좌</dt>
                      <dd>{quoteIssuerProfile.bankAccount || "—"}</dd>
                    </div>
                    <div>
                      <dt>예금주</dt>
                      <dd>{quoteIssuerProfile.accountHolder || "—"}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <p className="quote-invoice-label">공급자</p>
                  <p className="quote-invoice-brand">{quoteIssuerProfile.brandName}</p>
                  <dl className="quote-invoice-footer-list">
                    <div>
                      <dt>사업자등록번호</dt>
                      <dd>{quoteIssuerProfile.businessRegistrationNumber || "—"}</dd>
                    </div>
                    <div>
                      <dt>이메일</dt>
                      <dd>{quoteIssuerProfile.email || "—"}</dd>
                    </div>
                  </dl>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="quote-invoice-signature"
                    height={40}
                    src={quoteIssuerProfile.signatureSrc}
                    width={100}
                  />
                </div>
              </footer>
            </article>
          ) : (
            <>
              <div className="quote-costing-sliders">
                <label>
                  <span>
                    목표 마진 <strong>{targetMarginPercent}%</strong>
                  </span>
                  <PercentRangeInput
                    aria-label="목표 마진"
                    max={90}
                    min={0}
                    onValueChange={setTargetMarginPercent}
                    value={targetMarginPercent}
                  />
                </label>
                <label>
                  <span>
                    운영비 <strong>{operatingCostPercent}%</strong>
                  </span>
                  <PercentRangeInput
                    aria-label="운영비"
                    max={50}
                    min={0}
                    onValueChange={setOperatingCostPercent}
                    value={operatingCostPercent}
                  />
                </label>
              </div>

              <div className="quote-costing-packages">
                {livePackages.map((pkg, index) => {
                  const isOpen = Boolean(expanded[index]);
                  const summary = [
                    pkg.role || null,
                    pkg.months ? `${pkg.months}개월` : null,
                    pkg.headcount ? `${pkg.headcount}명` : null,
                    `${pkg.utilizationPercent}%`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const selectedRole = roleSelectValue(pkg.role);

                  return (
                    <article className={`quote-package ${isOpen ? "is-open" : "is-collapsed"}`} key={index}>
                      <div className="quote-package-summary">
                        <div className="quote-package-head">
                          <button
                            aria-expanded={isOpen}
                            className="quote-package-toggle"
                            onClick={() =>
                              setExpanded((current) => ({ ...current, [index]: !current[index] }))
                            }
                            type="button"
                          >
                            <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                          </button>
                          <label className="quote-package-title">
                            작업명
                            <input
                              onChange={(event) => updatePackage(index, { title: event.target.value })}
                              placeholder={`작업 패키지 ${index + 1}`}
                              required={tab === "internal"}
                              value={pkg.title}
                            />
                          </label>
                        </div>
                        {summary ? <p className="quote-package-meta">{summary}</p> : null}

                        <div className="quote-package-inline-edits">
                          <label className="quote-package-role">
                            역할 / 등급
                            <select
                              onChange={(event) => {
                                const next = event.target.value;
                                if (!next || next === "__custom__") return;
                                applyRole(index, next);
                              }}
                              value={selectedRole === "__custom__" ? "__custom__" : selectedRole}
                            >
                              <option value="">선택</option>
                              {quoteRoleRates.map((item) => (
                                <option key={item.role} value={item.role}>
                                  {item.role} · {item.monthlyRate.toLocaleString("ko-KR")}원
                                </option>
                              ))}
                              {selectedRole === "__custom__" ? (
                                <option value="__custom__">{pkg.role} (저장된 값)</option>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            단가
                            <WonAmountInput
                              aria-label="단가"
                              onValueChange={(monthlyRate) =>
                                updatePackage(index, { monthlyRate, amountLocked: false })
                              }
                              value={pkg.monthlyRate}
                            />
                          </label>
                          <label>
                            개월
                            <input
                              inputMode="numeric"
                              min={0}
                              onChange={(event) =>
                                updatePackage(index, {
                                  months: Number(event.target.value) || 0,
                                  amountLocked: false,
                                })
                              }
                              step="0.5"
                              type="number"
                              value={pkg.months || ""}
                            />
                          </label>
                          <label>
                            인원
                            <input
                              inputMode="numeric"
                              min={0}
                              onChange={(event) =>
                                updatePackage(index, {
                                  headcount: Number(event.target.value) || 0,
                                  amountLocked: false,
                                })
                              }
                              step="0.5"
                              type="number"
                              value={pkg.headcount || ""}
                            />
                          </label>
                          <label className="quote-package-util">
                            가동률 {pkg.utilizationPercent}%
                            <PercentRangeInput
                              aria-label="가동률"
                              max={100}
                              min={1}
                              onValueChange={(utilizationPercent) =>
                                updatePackage(index, {
                                  utilizationPercent: utilizationPercent || 1,
                                  amountLocked: false,
                                })
                              }
                              value={pkg.utilizationPercent}
                            />
                          </label>
                          <label>
                            수량
                            <input
                              aria-label="고객 문서 수량"
                              inputMode="numeric"
                              min={1}
                              onChange={(event) =>
                                updatePackage(index, {
                                  quantity: Math.max(1, Math.round(Number(event.target.value) || 1)),
                                })
                              }
                              type="number"
                              value={pkg.quantity}
                            />
                          </label>
                          <label>
                            원가
                            <output>{won(pkg.costAmount)}</output>
                          </label>
                          <label>
                            {vatMode === "inclusive" ? "고객 금액" : "공급가"}
                            <WonAmountInput
                              aria-label={vatMode === "inclusive" ? "고객 금액" : "공급가"}
                              onValueChange={(amount) => updatePackage(index, { amount, amountLocked: true })}
                              value={pkg.amount}
                            />
                          </label>
                          {pkg.amountLocked ? (
                            <button className="text-link" onClick={() => unlockAndSuggest(index)} type="button">
                              제안가 다시 적용
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {isOpen ? (
                        <div className="quote-package-body">
                          <label>
                            고객용 설명 (PDF)
                            <textarea
                              onChange={(event) =>
                                updatePackage(index, { customerDescription: event.target.value })
                              }
                              placeholder="고객 견적서에만 보이는 설명"
                              value={pkg.customerDescription}
                            />
                          </label>
                          {packages.length > 1 ? (
                            <button
                              className="quote-item-remove"
                              onClick={() => {
                                setPackages((current) => current.filter((_, pkgIndex) => pkgIndex !== index));
                                setExpanded({});
                              }}
                              type="button"
                            >
                              패키지 삭제
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                <button className="text-link quote-item-add" onClick={addPackage} type="button">
                  패키지 추가
                </button>
              </div>
            </>
          )}
        </div>
        {aside}
      </div>
    </div>
  );
}
