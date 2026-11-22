import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Alert, Badge, fmt, fmtDate, kindLabel, Segmented, Stat } from '../ui';
import ItemsEditor, { cleanItems, emptyItem, Item, itemsTotal } from '../components/ItemsEditor';
import { BillModal, describeFilter, ItemsList, ReportModal } from '../components/BillModal';
import type { Kind, SaleBill } from '../types';

const zero = { count: 0, total: 0, profit: 0, hardware: 0, electronic: 0 };

export default function Sales() {
  const [rows, setRows] = useState<SaleBill[]>([]);
  const [totals, setTotals] = useState(zero);
  const [flt, setFlt] = useState({ from: '', to: '', category: '' });
  const [next, setNext] = useState({ bill_no: '', date: '' });
  const [category, setCategory] = useState<Kind>('hardware');
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [profit, setProfit] = useState('');
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [view, setView] = useState<SaleBill | null>(null);
  const [report, setReport] = useState(false);

  const load = useCallback(async () => {
    const q = new URLSearchParams(); Object.entries(flt).forEach(([k, v]) => v && q.set(k, v));
    const d = await api('/sales?' + q); setRows(d.rows); setTotals(d.totals);
  }, [flt]);
  const loadNext = useCallback(() => api('/sales/next').then(setNext), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadNext(); }, [loadNext]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    try {
      const r = await api('/sales', { body: { category, items: cleanItems(items), profit: profit === '' ? 0 : Number(profit) } });
      setOk(`Bill ${r.bill_no} saved (${fmt(r.total)}, profit ${fmt(r.profit)})`);
      setItems([emptyItem()]); setProfit(''); loadNext(); load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <h1>Sales <span className="muted small">sale invoices</span></h1>
      <form className="card" onSubmit={submit}>
        <div className="meta"><span>Bill no: <b>{next.bill_no || '...'}</b> (auto)</span><span>Date: <b>{fmtDate(next.date)}</b> (auto)</span></div>
        <Alert>{err}</Alert><Alert tone="ok">{ok}</Alert>
        <label>Goods category</label>
        <Segmented value={category} onChange={setCategory} options={[{ v: 'hardware', l: 'Hardware' }, { v: 'electronic', l: 'Electronic' }]} />
        <ItemsEditor items={items} onChange={setItems} />
        <label>Profit on this bill (Rs)<input type="number" step="any" placeholder="0" value={profit} onChange={(e) => setProfit(e.target.value)} /></label>
        <button className="btn" disabled={busy || itemsTotal(items) <= 0}>{busy ? 'Saving...' : 'Save sale bill'}</button>
      </form>

      <section>
        <div className="filters">
          <label>From<input type="date" value={flt.from} onChange={(e) => setFlt({ ...flt, from: e.target.value })} /></label>
          <label>To<input type="date" value={flt.to} onChange={(e) => setFlt({ ...flt, to: e.target.value })} /></label>
          <label>Category<select value={flt.category} onChange={(e) => setFlt({ ...flt, category: e.target.value })}><option value="">All</option><option value="hardware">Hardware</option><option value="electronic">Electronic</option></select></label>
          <button className="btn ghost" onClick={() => setReport(true)}>View / Print report</button>
        </div>
        <div className="grid">
          <Stat label="Total sales" value={fmt(totals.total)} sub={`${totals.count} bills`} tone="accent" />
          <Stat label="Total profit" value={fmt(totals.profit)} tone="good" />
          <Stat label="Hardware sales" value={fmt(totals.hardware)} />
          <Stat label="Electronic sales" value={fmt(totals.electronic)} />
        </div>
        <div className="table-wrap cards">
          <table className="responsive">
            <thead><tr><th>Date</th><th>Bill no</th><th>Category</th><th>Items</th><th className="r">Total</th><th className="r">Profit</th><th className="r">View</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td data-label="Date" className="nowrap">{fmtDate(b.bill_date)}</td><td data-label="Bill no" className="nowrap"><b>{b.bill_no}</b></td>
                  <td data-label="Category"><Badge tone={b.category === 'hardware' ? 'warn' : 'ok'}>{kindLabel(b.category)}</Badge></td>
                  <td data-label="Items"><ItemsList items={b.items} /></td>
                  <td data-label="Total" className="r"><b>{fmt(b.total)}</b></td><td data-label="Profit" className="r good">{fmt(b.profit)}</td>
                  <td data-label="Invoice" className="r"><button className="btn ghost sm" onClick={() => setView(b)}>View</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="empty">No sale bills match these filters.</td></tr>}
            </tbody>
            {!!rows.length && <tfoot><tr><td colSpan={4}>Total sales ({totals.count} bills)</td><td data-label="Total" className="r">{fmt(totals.total)}</td><td data-label="Profit" className="r">{fmt(totals.profit)}</td><td /></tr></tfoot>}
          </table>
        </div>
      </section>

      {view && <BillModal type="sale" bill={view} onClose={() => setView(null)} />}
      {report && (
        <ReportModal
          title="Sales Report" onClose={() => setReport(false)}
          filters={describeFilter(flt.from, flt.to, 'Category', flt.category)}
          columns={[{ label: 'Date' }, { label: 'Bill no' }, { label: 'Category' }, { label: 'Items' }, { label: 'Total', right: true }, { label: 'Profit', right: true }]}
          rows={rows.map((b) => [fmtDate(b.bill_date), b.bill_no, kindLabel(b.category), <ItemsList items={b.items} />, fmt(b.total), fmt(b.profit)])}
          footer={[`Total (${totals.count} bills)`, '', '', '', fmt(totals.total), fmt(totals.profit)]}
          summary={[['Hardware sales', fmt(totals.hardware)], ['Electronic sales', fmt(totals.electronic)]]}
        />
      )}
    </>
  );
}
