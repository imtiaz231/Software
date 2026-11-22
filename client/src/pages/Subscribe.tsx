import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Badge, fmt, fmtDate, fmtDT, monthsLabel, Segmented } from '../ui';
import type { Payment } from '../types';

interface Info { price_per_month: number; max_months: number; hbl_title: string; hbl_account: string; jazzcash_title: string; jazzcash_number: string; support_phone: string }

// Adds calendar months; Jan 31 + 1 month = Feb 28/29 (same rule as the server)
function addMonths(date: Date, n: number) {
  const d = new Date(date), day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

export default function Subscribe() {
  const { shop, refresh } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [list, setList] = useState<Payment[]>([]);
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<'HBL' | 'JazzCash'>('JazzCash');
  const [txn, setTxn] = useState(''); const [shot, setShot] = useState<File | null>(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);

  const load = useCallback(() => { api('/shop/payment-info').then(setInfo); api('/shop/payments').then(setList); }, []);
  useEffect(() => { load(); }, [load]);
  const pending = list.some((p) => p.status === 'pending');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    const fd = new FormData(); fd.set('method', method); fd.set('months', String(months)); fd.set('txn_ref', txn); if (shot) fd.set('screenshot', shot);
    try { await api('/shop/payments', { form: fd }); setOk('Payment submitted. The admin will verify it and activate your access.'); setTxn(''); setShot(null); load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  if (!info) return <p className="muted">Loading...</p>;
  const amount = months * info.price_per_month;
  const start = shop!.access && shop!.expires_at ? new Date(shop!.expires_at) : new Date();
  const until = addMonths(start, months);
  const acct = method === 'HBL' ? { t: info.hbl_title, n: info.hbl_account, l: 'HBL account no / IBAN' } : { t: info.jazzcash_title, n: info.jazzcash_number, l: 'JazzCash number' };

  return (
    <>
      <h1>Subscription</h1>
      <div className="card">
        {shop!.access
          ? <p>Your access is valid until <b>{fmtDate(shop!.expires_at)}</b> ({shop!.daysLeft} days left). If you renew early, the new months are added after your current expiry date.</p>
          : <p>{shop!.expires_at ? 'Your subscription has expired.' : 'Make a payment to start using the software.'} Access starts as soon as the admin approves your payment.</p>}
      </div>
      <form className="card" onSubmit={submit}>
        <h2>Make a payment</h2>
        <Alert>{err}</Alert><Alert tone="ok">{ok}</Alert>
        {pending && <Alert tone="warn">You already have a payment under review. Please wait for approval.</Alert>}
        <label id="months-label">How many months do you want to buy? ({fmt(info.price_per_month)} per month)</label>
        <div className="chips" role="radiogroup" aria-labelledby="months-label">
          {Array.from({ length: info.max_months }, (_, i) => i + 1).map((m) => (
            <button type="button" key={m} role="radio" aria-checked={months === m} className={months === m ? 'on' : ''} onClick={() => setMonths(m)}>{m}</button>
          ))}
        </div>
        <div className="pay-summary">
          <div><span>Duration</span><b>{monthsLabel(months)}</b></div>
          <div><span>Total to pay</span><b>{fmt(amount)}</b></div>
          <div><span>Access until</span><b>{fmtDate(until.toISOString())}</b></div>
        </div>
        <label>Pay via</label>
        <Segmented value={method} onChange={setMethod} options={[{ v: 'JazzCash', l: 'JazzCash' }, { v: 'HBL', l: 'HBL' }]} />
        <div className="pay-box">
          <div>{acct.l}</div>
          <strong>{acct.n || 'Not set by the admin yet'}</strong>
          <div className="muted">{acct.t}</div>
          <div className="pay-amt">Amount to send: <b>{fmt(amount)}</b></div>
        </div>
        <label>Transaction ID / reference number<input value={txn} onChange={(e) => setTxn(e.target.value)} required /></label>
        <label>Payment screenshot (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setShot(e.target.files?.[0] || null)} /></label>
        <button className="btn" disabled={busy || pending}>{busy ? 'Submitting...' : `Submit payment of ${fmt(amount)}`}</button>
        {info.support_phone && <p className="muted">Need help? Call {info.support_phone}</p>}
      </form>
      {!!list.length && (
        <div className="table-wrap"><table>
          <thead><tr><th>Date</th><th>Method</th><th>Duration</th><th className="r">Amount</th><th>Reference</th><th>Status</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}><td className="nowrap">{fmtDT(p.created_at)}</td><td>{p.method}</td><td>{monthsLabel(p.months)}</td><td className="r">{fmt(p.amount)}</td><td>{p.txn_ref}</td>
              <td><Badge tone={p.status === 'approved' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad'}>{p.status}</Badge>{p.note && <div className="muted small">{p.note}</div>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <button className="btn ghost" onClick={refresh}>Refresh status</button>
    </>
  );
}
