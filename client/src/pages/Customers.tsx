import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Alert, fmt, fmtDate, Segmented, Stat } from '../ui';
import type { Customer } from '../types';

export default function Customers() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Customer[]>([]);
  const [sum, setSum] = useState({ outstanding: 0, due_customers: 0, customers: 0 });
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'due'>('all');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', address: '' });
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (show === 'due') p.set('due', '1');
    return api('/customers?' + p).then((d) => { setRows(d.rows); setSum(d.summary); });
  }, [q, show]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try { const d = await api('/customers', { body: f }); nav('/customers/' + d.id); }
    catch (e: any) { setErr(e.message); }
  };

  return (
    <>
      <h1>Customers <span className="muted small">credit accounts (udhaar / khata)</span></h1>
      <div className="grid">
        <Stat label="Total owed by customers" value={fmt(sum.outstanding)} tone={sum.outstanding > 0 ? 'accent' : 'good'} />
        <Stat label="Customers with a balance" value={sum.due_customers} />
        <Stat label="All customers" value={sum.customers} />
      </div>

      <div className="filters">
        <label className="search">Find a customer (name or phone)<input type="search" placeholder="Type a name or phone number" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Segmented value={show} onChange={setShow} options={[{ v: 'all', l: 'All customers' }, { v: 'due', l: 'Balance due' }]} />
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? 'Close' : '+ New customer'}</button>
      </div>

      {adding && (
        <form className="card" onSubmit={add}>
          <h2>New customer</h2>
          <Alert>{err}</Alert>
          <div className="cols">
            <label>Customer name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
            <label>Phone number<input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
            <label>Address (optional)<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
          </div>
          <button className="btn">Create customer and open account</button>
        </form>
      )}

      <div className="table-wrap cards">
        <table className="responsive">
          <thead><tr><th>Customer</th><th>Phone</th><th>Last activity</th><th className="r">Balance due</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td data-label="Customer"><b>{c.name}</b></td>
                <td data-label="Phone">{c.phone}</td>
                <td data-label="Last activity">{fmtDate(c.last_activity)}</td>
                <td data-label="Balance due" className={'r ' + (c.balance > 0 ? 'bad' : 'good')}><b>{c.balance > 0 ? fmt(c.balance) : 'Settled'}</b></td>
                <td className="r"><Link className="btn sm" to={'/customers/' + c.id}>Open account</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="empty">{q || show === 'due' ? 'No customers match your search.' : 'No customers yet. Tap "+ New customer" to add the first one.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
