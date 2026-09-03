"use client";

import { useState } from "react";

type QuoteItem = { description: string; amount: number };

export function QuoteItemsFields({ initialItems = [{ description: "", amount: 0 }] }: { initialItems?: QuoteItem[] }) {
  const [items, setItems] = useState(initialItems);
  return <div className="quote-items-fields">
    <div className="quote-item-labels"><span>항목</span><span>공급가액 (원)</span></div>
    {items.map((item, index) => <div className="quote-item-inputs" key={index}>
      <input defaultValue={item.description} name="itemDescription" placeholder="예: 홈페이지 기획" required />
      <input defaultValue={item.amount || ""} min="1" name="itemAmount" required type="number" />
      {items.length > 1 ? <button className="quote-item-remove" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} type="button">삭제</button> : null}
    </div>)}
    <button className="text-link quote-item-add" onClick={() => setItems([...items, { description: "", amount: 0 }])} type="button">항목 추가</button>
  </div>;
}
