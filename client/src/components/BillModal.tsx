import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../auth';
import { api, apiBlob } from '../api';
import { prepareImage } from '../imageUtil';
import { fmt, fmtDate, kindLabel } from '../ui';
import type { BillItem, PurchaseBill, SaleBill } from '../types';

/* Generic modal that renders into <body> so that printing shows ONLY this document. */
export function Modal({ title, onClose, extra, children }: { title: string; onClose: () => void; extra?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-bar no-print">
          <strong>{title}</strong>
          <div className="actions">
            {extra}
            <button className="btn" onClick={() => window.print()}>Print</button>
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="print-area">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function Letterhead() {
  const { shop } = useAuth();
  if (!shop) return null;
  return (
    <div className="doc-head">
      {shop.logo && <img src={shop.logo} alt="" />}
      <div><h2>{shop.name}</h2><div>{shop.address}</div><div>Phone: {shop.phone}</div></div>
    </div>
  );
}

export const ItemsList = ({ items }: { items: BillItem[] }) => (
  <>{items.map((i, k) => <div key={k} className="small">{i.name} x {i.qty} @ {fmt(i.price)}</div>)}</>
);

/* ---------- Photo of the supplier's paper bill (private, loaded with the login token) ---------- */
function PurchasePhoto({ bill, printIt, onChanged }: { bill: PurchaseBill; printIt: boolean; onChanged?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!bill.has_image) { setUrl(null); return; }
    let alive = true, obj = '';
    apiBlob(`/purchases/${bill.id}/image`).then((b) => { if (alive) { obj = URL.createObjectURL(b); setUrl(obj); } }).catch((e) => alive && setErr(e.message));
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [bill.id, bill.has_image, version]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setBusy(true);
    try {
      const fd = new FormData(); fd.set('bill_image', await prepareImage(f));
      await api(`/purchases/${bill.id}/image`, { form: fd });
      setVersion((v) => v + 1); onChanged?.();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className={'photo-block' + (printIt && bill.has_image ? '' : ' no-print')}>
      <div className="photo-head no-print">
        <b>Supplier bill photo</b>
        <label className={'btn ghost sm file-btn' + (busy ? ' disabled' : '')}>
          {busy ? 'Uploading...' : bill.has_image ? 'Replace photo' : 'Attach photo'}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={upload} />
        </label>
      </div>
      {err && <div className="alert bad no-print">{err}</div>}
      {bill.has_image
        ? (url ? <a href={url} target="_blank" rel="noreferrer" title="Open full size"><img className="bill-photo" src={url} alt={`Supplier bill for ${bill.bill_no}`} /></a> : !err && <p className="muted no-print">Loading photo...</p>)
        : <p className="muted no-print">No photo is attached to this bill yet.</p>}
    </div>
  );
}

/* ---------- Single bill (view / print) ---------- */
export function BillModal({ type, bill, onClose, onChanged }: { type: 'sale' | 'purchase'; bill: SaleBill | PurchaseBill; onClose: () => void; onChanged?: () => void }) {
  const [withProfit, setWithProfit] = useState(false);
  const [withPhoto, setWithPhoto] = useState(false);
  const sale = type === 'sale' ? (bill as SaleBill) : null;
  const purchase = type === 'purchase' ? (bill as PurchaseBill) : null;
  return (
    <Modal
      title={`${type === 'sale' ? 'Sale invoice' : 'Purchase bill'} ${bill.bill_no}`}
      onClose={onClose}
      extra={<>
        {sale && <label className="inline-check"><input type="checkbox" checked={withProfit} onChange={(e) => setWithProfit(e.target.checked)} /> Include profit on printout</label>}
        {purchase?.has_image && <label className="inline-check"><input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} /> Include bill photo on printout</label>}
      </>}
    >
      <Letterhead />
      <h3 className="doc-title">{type === 'sale' ? 'SALE INVOICE' : 'PURCHASE BILL'}</h3>
      <div className="doc-meta">
        <div><span>Bill no</span><b>{bill.bill_no}</b></div>
        <div><span>Date</span><b>{fmtDate(bill.bill_date)}</b></div>
        {sale && <div><span>Category</span><b>{kindLabel(sale.category)}</b></div>}
        {purchase && <>
          <div><span>Dealer</span><b>{purchase.dealer_name}</b></div>
          <div><span>Company</span><b>{purchase.dealer_company}</b></div>
          <div><span>Dealer phone</span><b>{purchase.dealer_phone}</b></div>
          <div><span>Dealer type</span><b>{kindLabel(purchase.dealer_type)}</b></div>
        </>}
      </div>
      <table className="doc-table">
        <thead><tr><th>#</th><th>Item</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {bill.items.map((i, k) => <tr key={k}><td>{k + 1}</td><td>{i.name}</td><td className="r">{i.qty}</td><td className="r">{fmt(i.price)}</td><td className="r">{fmt(i.qty * i.price)}</td></tr>)}
        </tbody>
        <tfoot>
          <tr><td colSpan={4}>Total</td><td className="r">{fmt(bill.total)}</td></tr>
          {sale && withProfit && <tr><td colSpan={4}>Profit</td><td className="r">{fmt(sale.profit)}</td></tr>}
        </tfoot>
      </table>
      {purchase && <PurchasePhoto bill={purchase} printIt={withPhoto} onChanged={onChanged} />}
      {sale && <p className="doc-foot">Thank you for your business.</p>}
    </Modal>
  );
}

/* ---------- Filtered report (preview before printing) ---------- */
export interface Col { label: string; right?: boolean }
export function ReportModal(props: {
  title: string; filters: string; columns: Col[]; rows: React.ReactNode[][]; footer: React.ReactNode[];
  summary: [string, string][]; onClose: () => void;
}) {
  const { title, filters, columns, rows, footer, summary, onClose } = props;
  return (
    <Modal title={`${title} - preview`} onClose={onClose}>
      <Letterhead />
      <h3 className="doc-title">{title.toUpperCase()}</h3>
      <p className="doc-filter">{filters} &nbsp;|&nbsp; Printed on {fmtDate(new Date().toLocaleDateString('en-CA'))}</p>
      <table className="doc-table">
        <thead><tr>{columns.map((c, i) => <th key={i} className={c.right ? 'r' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={columns[j].right ? 'r' : ''}>{c}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length} className="empty">No bills match the selected filters.</td></tr>}
        </tbody>
        <tfoot><tr>{footer.map((c, j) => <td key={j} className={columns[j].right ? 'r' : ''}>{c}</td>)}</tr></tfoot>
      </table>
      <div className="doc-summary">{summary.map(([l, v]) => <div key={l}><span>{l}</span><b>{v}</b></div>)}</div>
    </Modal>
  );
}

export function describeFilter(from: string, to: string, label: string, value: string) {
  const date = from || to ? `Date: ${from ? fmtDate(from) : 'start'} to ${to ? fmtDate(to) : 'today'}` : 'Date: all dates';
  return `${date}  |  ${label}: ${value ? kindLabel(value) : 'All'}`;
}
