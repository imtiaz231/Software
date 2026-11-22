import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Badge, fmt, fmtDate, Segmented, Stat } from '../ui';
import ItemsEditor, { cleanItems, emptyItem, Item, itemsTotal } from '../components/ItemsEditor';
import { ItemsList, Letterhead, Modal } from '../components/BillModal';
import type { Kind, LedgerEntry } from '../types';

interface Detail {
  customer: { id: number; name: string; phone: string; address: string | null };
  balance: number; total_credit: number; total_paid: number; entries: LedgerEntry[];
}

// 0300... -> 92300... (WhatsApp wants the international number without "+")
const waNumber = (p: string) => { const d = p.replace(/\D/g, ''); return d.startsWith('0') ? '92' + d.slice(1) : d; };

function Details({ e }: { e: LedgerEntry }) {
  return (
    <div className="cell-stack">
      {e.items && <ItemsList items={e.items} />}
      {e.note && <div className="small muted">{e.note}</div>}
      {e.sale_bill_no && <div className="small"><Badge tone="mute">Sale bill {e.sale_bill_no}</Badge></div>}
      {!!e.voided && <div className="small bad">Voided: {e.void_reason}</div>}
    </div>
  );
}

export default function CustomerAccount() {
  const { id } = useParams();
  const nav = useNavigate();
  const { shop } = useAuth();
  const [d, setD] = useState<Detail | null>(null);
  const [mode, setMode] = useState<'credit' | 'payment'>('credit');
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [paidNow, setPaidNow] = useState(''); const [asSale, setAsSale] = useState(false);
  const [category, setCategory] = useState<Kind>('hardware'); const [profit, setProfit] = useState(''); const [note, setNote] = useState('');
  const [amount, setAmount] = useState(''); const [payNote, setPayNote] = useState('');
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [ef, setEf] = useState({ name: '', phone: '', address: '' });
  const [statement, setStatement] = useState(false);

  const load = useCallback(() => api('/customers/' + id).then(setD).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return err ? <Alert>{err}</Alert> : <p className="muted">Loading...</p>;
  const c = d.customer, due = d.balance > 0.005;

  const run = async (fn: () => Promise<void>) => {
    setErr(''); setMsg(''); setBusy(true);
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const giveCredit = (e: FormEvent) => { e.preventDefault(); run(async () => {
    const r = await api(`/customers/${c.id}/credit`, { body: {
      items: cleanItems(items), paid_now: paidNow === '' ? 0 : Number(paidNow), note,
      record_sale: asSale, category, profit: profit === '' ? 0 : Number(profit),
    } });
    setMsg(`Credit ${r.credit.ref_no} of ${fmt(r.total)} saved.${r.sale_bill_no ? ` Also recorded as sale bill ${r.sale_bill_no}.` : ''} Balance due: ${fmt(r.balance)}.`);
    setItems([emptyItem()]); setPaidNow(''); setProfit(''); setNote(''); setAsSale(false); await load();
  }); };
  const receive = (e: FormEvent) => { e.preventDefault(); run(async () => {
    const r = await api(`/customers/${c.id}/payment`, { body: { amount: Number(amount), note: payNote } });
    setMsg(r.balance > 0.005 ? `Payment ${r.ref_no} received. Remaining balance: ${fmt(r.balance)}.` : `Payment ${r.ref_no} received. The account is fully settled - no balance left.`);
    setAmount(''); setPayNote(''); await load();
  }); };
  const voidEntry = async (en: LedgerEntry) => {
    const extra = en.sale_bill_no ? `\nThe linked sale bill ${en.sale_bill_no} will also be cancelled.` : '';
    const reason = prompt(`Void ${en.ref_no} (${fmt(en.amount)})? It stays in the statement marked as voided.${extra}\n\nReason:`);
    if (reason === null) return;
    run(async () => { const r = await api(`/ledger/${en.id}/void`, { body: { reason } }); setMsg(`${en.ref_no} voided. Balance due: ${fmt(r.balance)}.`); await load(); });
  };
  const saveCustomer = (e: FormEvent) => { e.preventDefault(); run(async () => { await api('/customers/' + c.id, { method: 'PUT', body: ef }); setEditing(false); await load(); }); };
  const remove = () => {
    if (!confirm(`Delete customer "${c.name}"? This only works for customers with no ledger history.`)) return;
    run(async () => { await api('/customers/' + c.id, { method: 'DELETE' }); nav('/customers'); });
  };

  const reminder = `Assalam o Alaikum ${c.name}, this is a friendly reminder from ${shop?.name}. Your outstanding balance is ${fmt(d.balance)}. Please pay at your earliest convenience. Thank you.`;
  const newestFirst = [...d.entries].reverse();

  return (
    <>
      <p><Link to="/customers">&larr; All customers</Link></p>
      <h1>{c.name}</h1>
      <p className="muted">{c.phone}{c.address ? ` | ${c.address}` : ''}</p>

      <div className={'balance-box' + (due ? ' due' : '')}>
        <div>
          <div className="muted">{due ? 'Balance due from this customer' : 'Account settled'}</div>
          <div className="amt">{due ? fmt(d.balance) : 'Rs 0'}</div>
        </div>
        <div className="toolbar">
          <a className="btn ghost" href={`tel:${c.phone}`}>Call</a>
          {due && <a className="btn wa" href={`https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer">WhatsApp reminder</a>}
          <button className="btn ghost" onClick={() => setStatement(true)}>View / Print statement</button>
        </div>
      </div>

      <div className="grid" style={{ marginTop: '1rem' }}>
        <Stat label="Total credit given" value={fmt(d.total_credit)} />
        <Stat label="Total received" value={fmt(d.total_paid)} tone="good" />
        <Stat label="Balance due" value={fmt(d.balance)} tone={due ? 'accent' : 'good'} />
      </div>

      <Alert>{err}</Alert><Alert tone="ok">{msg}</Alert>

      <div className="card">
        <Segmented value={mode} onChange={setMode} options={[{ v: 'credit', l: 'Give goods on credit' }, { v: 'payment', l: 'Receive payment' }]} />
        {mode === 'credit' ? (
          <form className="form-col" onSubmit={giveCredit}>
            <p className="muted">Add what the customer took and the price of each item. Anything not paid now is added to their balance.</p>
            <ItemsEditor items={items} onChange={setItems} />
            <label>Paid now (optional, Rs)<input type="number" min="0" step="any" placeholder="0" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} /></label>
            <label className="inline-check"><input type="checkbox" checked={asSale} onChange={(e) => setAsSale(e.target.checked)} /> Also record this as a sale bill (adds to Sales totals and profit)</label>
            {asSale && (
              <div className="inline-box">
                <Segmented value={category} onChange={setCategory} options={[{ v: 'hardware', l: 'Hardware' }, { v: 'electronic', l: 'Electronic' }]} />
                <label>Profit on this sale (Rs)<input type="number" step="any" placeholder="0" value={profit} onChange={(e) => setProfit(e.target.value)} /></label>
              </div>
            )}
            <label>Note (optional)<input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <button className="btn" disabled={busy || itemsTotal(items) <= 0}>{busy ? 'Saving...' : `Save credit (${fmt(Math.max(itemsTotal(items) - (Number(paidNow) || 0), 0))} added to balance)`}</button>
          </form>
        ) : (
          <form className="form-col" onSubmit={receive}>
            {due ? <p className="muted">The customer owes <b>{fmt(d.balance)}</b>. Enter the amount received now. Any amount left stays on the account.</p> : <Alert tone="ok">This customer has no balance due.</Alert>}
            <label>Amount received (Rs)
              <input type="number" min="0" step="any" max={d.balance} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!due} required />
            </label>
            <div className="toolbar">
              <button type="button" className="btn ghost sm" disabled={!due} onClick={() => setAmount(String(d.balance))}>Full balance ({fmt(d.balance)})</button>
            </div>
            <label>Note (optional, e.g. cash / JazzCash)<input maxLength={200} value={payNote} onChange={(e) => setPayNote(e.target.value)} /></label>
            <button className="btn" disabled={busy || !due || !(Number(amount) > 0)}>{busy ? 'Saving...' : 'Receive payment'}</button>
          </form>
        )}
      </div>

      <h2>Statement</h2>
      <div className="table-wrap cards">
        <table className="responsive">
          <thead><tr><th>Date</th><th>Ref</th><th>Details</th><th className="r">Credit given</th><th className="r">Received</th><th className="r">Balance</th><th /></tr></thead>
          <tbody>
            {newestFirst.map((e) => (
              <tr key={e.id} className={e.voided ? 'voided' : ''}>
                <td data-label="Date" className="nowrap">{fmtDate(e.entry_date)}</td>
                <td data-label="Ref" className="nowrap"><b>{e.ref_no}</b></td>
                <td data-label="Details"><Details e={e} /></td>
                <td data-label="Credit given" className={'r' + (e.voided ? ' strike' : '')}>{e.type === 'credit' ? fmt(e.amount) : ''}</td>
                <td data-label="Received" className={'r' + (e.voided ? ' strike' : ' good')}>{e.type === 'payment' ? fmt(e.amount) : ''}</td>
                <td data-label="Balance" className="r"><b>{fmt(e.running_balance)}</b></td>
                <td className="r">{!e.voided && <button className="btn ghost sm danger" onClick={() => voidEntry(e)}>Void</button>}</td>
              </tr>
            ))}
            {!d.entries.length && <tr><td colSpan={7} className="empty">No entries yet. Give goods on credit above to start this account.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Customer details</h2>
        {editing ? (
          <form className="form-col" onSubmit={saveCustomer}>
            <div className="cols">
              <label>Name<input value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} required /></label>
              <label>Phone<input inputMode="tel" value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} required /></label>
              <label>Address<input value={ef.address} onChange={(e) => setEf({ ...ef, address: e.target.value })} /></label>
            </div>
            <div className="actions"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button></div>
          </form>
        ) : (
          <div className="actions">
            <button className="btn ghost" onClick={() => { setEf({ name: c.name, phone: c.phone, address: c.address || '' }); setEditing(true); }}>Edit details</button>
            <button className="btn ghost danger" onClick={remove}>Delete customer</button>
          </div>
        )}
      </div>

      {statement && (
        <Modal title={`Statement - ${c.name}`} onClose={() => setStatement(false)}>
          <Letterhead />
          <h3 className="doc-title">CUSTOMER STATEMENT</h3>
          <div className="doc-meta">
            <div><span>Customer</span><b>{c.name}</b></div>
            <div><span>Phone</span><b>{c.phone}</b></div>
            {c.address && <div><span>Address</span><b>{c.address}</b></div>}
            <div><span>Statement date</span><b>{fmtDate(new Date().toLocaleDateString('en-CA'))}</b></div>
          </div>
          <table className="doc-table">
            <thead><tr><th>Date</th><th>Ref</th><th>Details</th><th className="r">Credit given</th><th className="r">Received</th><th className="r">Balance</th></tr></thead>
            <tbody>
              {d.entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.entry_date)}</td><td>{e.ref_no}</td><td><Details e={e} /></td>
                  <td className={'r' + (e.voided ? ' strike' : '')}>{e.type === 'credit' ? fmt(e.amount) : ''}</td>
                  <td className={'r' + (e.voided ? ' strike' : '')}>{e.type === 'payment' ? fmt(e.amount) : ''}</td>
                  <td className="r">{fmt(e.running_balance)}</td>
                </tr>
              ))}
              {!d.entries.length && <tr><td colSpan={6} className="empty">No entries.</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={3}>Totals</td><td className="r">{fmt(d.total_credit)}</td><td className="r">{fmt(d.total_paid)}</td><td className="r">{fmt(d.balance)}</td></tr></tfoot>
          </table>
          <div className="doc-summary"><div><span>Balance due</span><b>{fmt(d.balance)}</b></div></div>
        </Modal>
      )}
    </>
  );
}
