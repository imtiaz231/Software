import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Alert, Badge, fmt, fmtDate, kindLabel, Segmented, Stat } from '../ui';
import { prepareImage } from '../imageUtil';
import ItemsEditor, { cleanItems, emptyItem, Item, itemsTotal } from '../components/ItemsEditor';
import { BillModal, describeFilter, ItemsList, ReportModal } from '../components/BillModal';
import type { Dealer, Kind, PurchaseBill } from '../types';

const zero = { count: 0, total: 0, hardware: 0, electronic: 0 };

export default function Purchases() {
  const [rows, setRows] = useState<PurchaseBill[]>([]);
  const [totals, setTotals] = useState(zero);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [flt, setFlt] = useState({ from: '', to: '', dealer_type: '' });
  const [next, setNext] = useState({ bill_no: '', date: '' });
  const [type, setType] = useState<Kind>('hardware');
  const [dealerId, setDealerId] = useState('');
  const [newDealer, setNewDealer] = useState<{ name: string; company: string; phone: string } | null>(null);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const view = rows.find((r) => r.id === viewId) || null;   // always the latest copy of the bill
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [report, setReport] = useState(false);

  const load = useCallback(async () => {
    const q = new URLSearchParams(); Object.entries(flt).forEach(([k, v]) => v && q.set(k, v));
    const d = await api('/purchases?' + q); setRows(d.rows); setTotals(d.totals);
  }, [flt]);
  const loadMeta = useCallback(() => { api('/purchases/next').then(setNext); api('/dealers').then(setDealers); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => setDealerId(''), [type]);

  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const u = URL.createObjectURL(photo); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Please choose a photo (image file) of the bill.'); return; }
    setErr(''); setPhoto(await prepareImage(f));
  };

  const typed = dealers.filter((d) => d.type === type);

  const addDealer = async () => {
    if (!newDealer) return; setErr('');
    try {
      const d = await api('/dealers', { body: { type, ...newDealer } });
      setNewDealer(null); const list: Dealer[] = await api('/dealers'); setDealers(list); setDealerId(String(d.id));
    } catch (e: any) { setErr(e.message); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    try {
      const fd = new FormData();
      fd.set('dealer_id', dealerId); fd.set('items', JSON.stringify(cleanItems(items)));
      if (photo) fd.set('bill_image', photo);
      const r = await api('/purchases', { form: fd });
      setOk(`Bill ${r.bill_no} saved (${fmt(r.total)})${r.has_image ? ' with the bill photo' : ''}`);
      setItems([emptyItem()]); setPhoto(null); loadMeta(); load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <h1>Purchases <span className="muted small">stock bought from dealers</span></h1>
      <form className="card" onSubmit={submit}>
        <div className="meta"><span>Bill no: <b>{next.bill_no || '...'}</b> (auto)</span><span>Date: <b>{fmtDate(next.date)}</b> (auto)</span></div>
        <Alert>{err}</Alert><Alert tone="ok">{ok}</Alert>
        <label>What type of goods did the dealer supply?</label>
        <Segmented value={type} onChange={setType} options={[{ v: 'hardware', l: 'Hardware dealer' }, { v: 'electronic', l: 'Electronic dealer' }]} />
        <label>Dealer
          <select value={dealerId} onChange={(e) => setDealerId(e.target.value)} required>
            <option value="">-- Select a {kindLabel(type).toLowerCase()} dealer --</option>
            {typed.map((d) => <option key={d.id} value={d.id}>{d.name} - {d.company} ({d.phone})</option>)}
          </select>
        </label>
        {newDealer ? (
          <div className="inline-box">
            <div className="cols">
              <input placeholder="Dealer name" value={newDealer.name} onChange={(e) => setNewDealer({ ...newDealer, name: e.target.value })} />
              <input placeholder="Company" value={newDealer.company} onChange={(e) => setNewDealer({ ...newDealer, company: e.target.value })} />
              <input placeholder="Phone" inputMode="tel" value={newDealer.phone} onChange={(e) => setNewDealer({ ...newDealer, phone: e.target.value })} />
            </div>
            <div className="actions"><button type="button" className="btn sm" onClick={addDealer}>Save dealer</button><button type="button" className="btn ghost sm" onClick={() => setNewDealer(null)}>Cancel</button></div>
          </div>
        ) : <button type="button" className="btn ghost sm" onClick={() => setNewDealer({ name: '', company: '', phone: '' })}>+ Register a new {kindLabel(type).toLowerCase()} dealer</button>}
        <ItemsEditor items={items} onChange={setItems} />
        <div className="photo-pick">
          <label>Photo of the supplier's bill (optional)</label>
          <div className="actions">
            <label className="btn ghost sm file-btn">Take or choose photo<input type="file" accept="image/*" hidden onChange={pickPhoto} /></label>
            {photo && <button type="button" className="btn ghost sm danger" onClick={() => setPhoto(null)}>Remove photo</button>}
          </div>
          {photo && <span className="muted small">{photo.name} ({(photo.size / 1048576).toFixed(1)} MB)</span>}
          {preview && <img className="photo-preview" src={preview} alt="Preview of the bill photo" />}
        </div>
        <button className="btn" disabled={busy || !dealerId || itemsTotal(items) <= 0}>{busy ? 'Saving...' : 'Save purchase bill'}</button>
      </form>

      <section>
        <div className="filters">
          <label>From<input type="date" value={flt.from} onChange={(e) => setFlt({ ...flt, from: e.target.value })} /></label>
          <label>To<input type="date" value={flt.to} onChange={(e) => setFlt({ ...flt, to: e.target.value })} /></label>
          <label>Dealer type<select value={flt.dealer_type} onChange={(e) => setFlt({ ...flt, dealer_type: e.target.value })}><option value="">All</option><option value="hardware">Hardware</option><option value="electronic">Electronic</option></select></label>
          <button className="btn ghost" onClick={() => setReport(true)}>View / Print report</button>
        </div>
        <div className="grid">
          <Stat label="Total purchases" value={fmt(totals.total)} sub={`${totals.count} bills`} tone="accent" />
          <Stat label="Hardware" value={fmt(totals.hardware)} />
          <Stat label="Electronic" value={fmt(totals.electronic)} />
        </div>
        <div className="table-wrap cards">
          <table className="responsive">
            <thead><tr><th>Date</th><th>Bill no</th><th>Dealer</th><th>Items</th><th className="r">Total bill</th><th className="r">View</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td data-label="Date" className="nowrap">{fmtDate(b.bill_date)}</td><td data-label="Bill no" className="nowrap"><div className="cell-stack"><b>{b.bill_no}</b><div className="small"><Badge tone={b.has_image ? 'ok' : 'mute'}>{b.has_image ? 'Photo attached' : 'No photo'}</Badge></div></div></td>
                  <td data-label="Dealer">{b.dealer_name}<div className="muted small">{b.dealer_company} <Badge tone={b.dealer_type === 'hardware' ? 'warn' : 'ok'}>{kindLabel(b.dealer_type)}</Badge></div></td>
                  <td data-label="Items"><ItemsList items={b.items} /></td>
                  <td data-label="Total bill" className="r"><b>{fmt(b.total)}</b></td>
                  <td data-label="Bill" className="r"><button className="btn ghost sm" onClick={() => setViewId(b.id)}>View</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="empty">No purchase bills match these filters.</td></tr>}
            </tbody>
            {!!rows.length && <tfoot><tr><td colSpan={4}>Total purchases ({totals.count} bills)</td><td data-label="Total" className="r">{fmt(totals.total)}</td><td /></tr></tfoot>}
          </table>
        </div>
      </section>

      {view && <BillModal type="purchase" bill={view} onClose={() => setViewId(null)} onChanged={load} />}
      {report && (
        <ReportModal
          title="Purchase Report" onClose={() => setReport(false)}
          filters={describeFilter(flt.from, flt.to, 'Dealer type', flt.dealer_type)}
          columns={[{ label: 'Date' }, { label: 'Bill no' }, { label: 'Dealer' }, { label: 'Type' }, { label: 'Items' }, { label: 'Total bill', right: true }]}
          rows={rows.map((b) => [fmtDate(b.bill_date), b.bill_no, `${b.dealer_name} (${b.dealer_company})`, kindLabel(b.dealer_type), <ItemsList items={b.items} />, fmt(b.total)])}
          footer={[`Total (${totals.count} bills)`, '', '', '', '', fmt(totals.total)]}
          summary={[['Hardware purchases', fmt(totals.hardware)], ['Electronic purchases', fmt(totals.electronic)]]}
        />
      )}
    </>
  );
}
