import {
  formatQuoteDocumentNumber,
  quoteInvoiceMaxLineItems,
  quoteVatModeLabels,
  type QuoteCustomerItem,
  type QuoteVatMode,
} from "@/lib/domain/quotes";
import {
  resolveQuoteIssuerProfile,
  type QuoteIssuerProfile,
  type WorkspaceCompanyProfileInput,
} from "@/lib/quotes/issuer";

function won(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function dash(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export type QuoteInvoiceDocumentProps = {
  clientName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  title: string;
  versionNumber: number;
  items: QuoteCustomerItem[];
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatMode: QuoteVatMode;
  note?: string | null;
  issuedOn: Date;
  validUntil: Date;
  issuer?: QuoteIssuerProfile | WorkspaceCompanyProfileInput | null;
};

function padInvoiceRows(items: QuoteCustomerItem[]) {
  const rows = items.slice(0, quoteInvoiceMaxLineItems);
  while (rows.length < quoteInvoiceMaxLineItems) {
    rows.push({
      title: "",
      customerDescription: "",
      quantity: 0,
      unitPrice: 0,
      amount: 0,
    });
  }
  return rows;
}

export function QuoteInvoiceDocument({
  clientName,
  contactName,
  contactPhone,
  title,
  versionNumber,
  items,
  subtotalAmount,
  vatAmount,
  totalAmount,
  vatMode,
  note,
  issuedOn,
  validUntil,
  issuer,
}: QuoteInvoiceDocumentProps) {
  const documentNumber = formatQuoteDocumentNumber(versionNumber, issuedOn);
  const profile = resolveQuoteIssuerProfile(issuer);
  const rows = padInvoiceRows(items);

  return (
    <article className="quote-document quote-document-invoice">
      <div className="quote-invoice-top">
        <header className="quote-invoice-header">
          <div className="quote-invoice-brand-block">
            <p className="quote-invoice-title">INVOICE</p>
            <p className="quote-invoice-lead">
              아래와 같이 견적드립니다.
              <br />
              검토 후 회신 부탁드립니다.
            </p>
          </div>
          <div className="quote-invoice-meta">
            <p className="quote-invoice-brand">{profile.brandName}</p>
            <dl>
              <div>
                <dt>견적번호</dt>
                <dd>{documentNumber}</dd>
              </div>
              <div>
                <dt>발행일</dt>
                <dd>{formatDate(issuedOn)}</dd>
              </div>
              <div>
                <dt>유효기간</dt>
                <dd>{formatDate(validUntil)}</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="quote-invoice-parties">
          <div>
            <p className="quote-invoice-label">수신</p>
            <p className="quote-invoice-client">{clientName}</p>
            {contactName?.trim() ? (
              <p className="quote-invoice-muted">담당자 {contactName.trim()}</p>
            ) : null}
            {contactPhone?.trim() ? (
              <p className="quote-invoice-muted">연락처 {contactPhone.trim()}</p>
            ) : null}
            {title.trim() ? <p className="quote-invoice-muted">{title.trim()}</p> : null}
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
            {rows.map((item, index) => {
              const empty = !item.title.trim();
              return (
                <tr className={empty ? "is-empty" : undefined} key={index}>
                  <td className="is-title">{empty ? null : <strong>{item.title}</strong>}</td>
                  <td className="is-desc">{empty ? null : item.customerDescription || "—"}</td>
                  <td className="is-qty is-num">{empty ? null : item.quantity}</td>
                  <td className="is-unit is-num">{empty ? null : won(item.unitPrice)}</td>
                  <td className="is-amount is-num">{empty ? null : won(item.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="quote-invoice-bottom">
        <section className="quote-invoice-summary">
          <div className="quote-invoice-note-block">
            <p>상기 금액은 {quoteVatModeLabels[vatMode]}입니다.</p>
            {note?.trim() ? <p className="quote-note">{note.trim()}</p> : null}
          </div>
          <div className="quote-totals">
            <p>
              <span>공급가액</span>
              <strong className="is-num">{won(subtotalAmount)}</strong>
            </p>
            <p>
              <span>부가세</span>
              <strong className="is-num">{won(vatAmount)}</strong>
            </p>
            <p className="quote-total">
              <span>합계</span>
              <strong className="is-num">{won(totalAmount)}</strong>
            </p>
          </div>
        </section>

        <footer className="quote-invoice-footer">
          <div>
            <p className="quote-invoice-label">입금 안내</p>
            <dl className="quote-invoice-footer-list">
              <div>
                <dt>은행</dt>
                <dd>{dash(profile.bankName)}</dd>
              </div>
              <div>
                <dt>계좌</dt>
                <dd>{dash(profile.bankAccount)}</dd>
              </div>
              <div>
                <dt>예금주</dt>
                <dd>{dash(profile.accountHolder)}</dd>
              </div>
              <div>
                <dt>SWIFT</dt>
                <dd>{dash(profile.swift)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="quote-invoice-label">공급자</p>
            <p className="quote-invoice-brand">{profile.brandName}</p>
            <dl className="quote-invoice-footer-list">
              <div>
                <dt>사업자등록번호</dt>
                <dd>{dash(profile.businessRegistrationNumber)}</dd>
              </div>
              {profile.representativeName ? (
                <div>
                  <dt>대표</dt>
                  <dd>{profile.representativeName}</dd>
                </div>
              ) : null}
              {profile.address ? (
                <div>
                  <dt>주소</dt>
                  <dd>{profile.address}</dd>
                </div>
              ) : null}
              <div>
                <dt>이메일</dt>
                <dd>{dash(profile.email)}</dd>
              </div>
            </dl>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="quote-invoice-signature"
              height={48}
              src={profile.signatureSrc}
              width={120}
            />
          </div>
        </footer>
      </div>
    </article>
  );
}
