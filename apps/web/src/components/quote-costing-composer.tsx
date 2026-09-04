"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
  calculatePackageCostAmount,
  calculateQuoteCosting,
  createEmptyQuotePackage,
  monthlyRateForRole,
  quoteRoleRates,
  suggestCustomerSupplyAmount,
  type QuotePackage,
  type QuoteVatMode,
} from "@/lib/domain/quotes";

type ComposerProps = {
  initialPackages?: QuotePackage[];
  initialVatMode?: QuoteVatMode;
  initialTargetMarginPercent?: number;
  initialOperatingCostPercent?: number;
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
}: {
  value: number;
  onValueChange: (value: number) => void;
  "aria-label"?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      autoComplete="off"
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

export function QuoteCostingComposer({
  initialPackages,
  initialVatMode = "exclusive",
  initialTargetMarginPercent = 30,
  initialOperatingCostPercent = 10,
  vatMode: controlledVatMode,
  onVatModeChange,
}: ComposerProps) {
  const [packages, setPackages] = useState<QuotePackage[]>(
    initialPackages?.length ? initialPackages : [createEmptyQuotePackage()],
  );
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
  const [tab, setTab] = useState<TabId>("internal");
  const [localVatMode, setLocalVatMode] = useState<QuoteVatMode>(initialVatMode);
  const [targetMarginPercent, setTargetMarginPercent] = useState(initialTargetMarginPercent);
  const [operatingCostPercent, setOperatingCostPercent] = useState(initialOperatingCostPercent);

  const vatMode = controlledVatMode ?? localVatMode;

  const setVatMode = (mode: QuoteVatMode) => {
    if (onVatModeChange) onVatModeChange(mode);
    else setLocalVatMode(mode);
  };

  const livePackages = useMemo(
    () =>
      packages.map((pkg) => {
        const costAmount = safeCost(pkg);
        const suggested = suggestedAmount(pkg, targetMarginPercent, operatingCostPercent, vatMode);
        const amount = pkg.amountLocked && pkg.amount > 0 ? pkg.amount : suggested;
        return { ...pkg, costAmount, amount };
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
      };
    }
  }, [livePackages, vatMode, targetMarginPercent, operatingCostPercent]);

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

  return (
    <div className="quote-costing">
      <input name="packagesJson" type="hidden" value={JSON.stringify(livePackages)} />
      <input name="targetMarginPercent" type="hidden" value={targetMarginPercent} />
      <input name="operatingCostPercent" type="hidden" value={operatingCostPercent} />
      {controlledVatMode == null ? <input name="vatMode" type="hidden" value={vatMode} /> : null}

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
        <label className="quote-costing-vat">
          부가세
          <select
            onChange={(event) => setVatMode(event.target.value as QuoteVatMode)}
            value={vatMode}
            {...(controlledVatMode != null ? { name: "vatMode" } : {})}
          >
            <option value="exclusive">미포함 (별도)</option>
            <option value="inclusive">포함</option>
          </select>
        </label>
      </div>

      {tab === "internal" ? (
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
      ) : (
        <p className="quote-costing-hint">
          고객 PDF에는 작업명·설명·금액만 나갑니다. 단가·가동률·마진은 포함되지 않습니다.
        </p>
      )}

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
                    onClick={() => setExpanded((current) => ({ ...current, [index]: !current[index] }))}
                    type="button"
                  >
                    <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  <label className="quote-package-title">
                    작업명
                    <input
                      onChange={(event) => updatePackage(index, { title: event.target.value })}
                      placeholder={`작업 패키지 ${index + 1}`}
                      required
                      value={pkg.title}
                    />
                  </label>
                </div>
                {tab === "internal" && summary ? <p className="quote-package-meta">{summary}</p> : null}

                <div className="quote-package-inline-edits">
                  {tab === "internal" ? (
                    <>
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
                        원가
                        <output>{won(pkg.costAmount)}</output>
                      </label>
                    </>
                  ) : null}
                  <label>
                    {vatMode === "inclusive" ? "고객 금액" : "공급가"}
                    <WonAmountInput
                      aria-label={vatMode === "inclusive" ? "고객 금액" : "공급가"}
                      onValueChange={(amount) => updatePackage(index, { amount, amountLocked: true })}
                      value={pkg.amount}
                    />
                  </label>
                  {tab === "internal" && pkg.amountLocked ? (
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
                      onChange={(event) => updatePackage(index, { customerDescription: event.target.value })}
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
        <button
          className="text-link quote-item-add"
          onClick={() => {
            setPackages((current) => [...current, createEmptyQuotePackage()]);
            setExpanded((current) => ({ ...current, [packages.length]: true }));
          }}
          type="button"
        >
          패키지 추가
        </button>
      </div>

      <aside className="quote-costing-live" aria-live="polite">
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
      </aside>
    </div>
  );
}
