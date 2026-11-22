import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Alert, Badge, fmt, kindLabel, Segmented } from '../ui';
import type { Dealer, Kind } from '../types';

const blank = { type: 'hardware' as Kind, name: '', company: '', phone: '' };

export default function Dealers() {
  const [rows, setRows] = useState<Dealer[]>([]);
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/dealers').then(setRows), []);
  useEffect(() => { load(); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try {
      if (editing) await api('/dealers/' + editing, { method: 'PUT', body: f });
      else await api('/dealers', { body: f });
      setF(blank); setEditing(null); load();
    } catch (e: any) { setErr(e.message); }
  };
  const del = async (d: Dealer) => {
    if (!confirm(`Delete dealer "${d.name}"?`)) return;
    try { await api('/dealers/' + d.id, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  };
  return (
    <>
      <h1>Dealers</h1>
      <form className="card" onSubmit={save}>
        <h2>{editing ? 'Edit dealer' : 'Register a new dealer'}</h2>
        <Alert>{err}</Alert>
        <Segmented value={f.type} onChange={(type) => setF({ ...f, type })} options={[{ v: 'hardware', l: 'Hardware dealer' }, { v: 'electronic', l: 'Electronic dealer' }]} />
        <div className="cols">
          <label>Dealer name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
          <label>Company<input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} required /></label>
          <label>Phone number<input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
        </div>
        <div className="actions">
          <button className="btn">{editing ? 'Save changes' : 'Add dealer'}</button>
          {editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setF(blank); }}>Cancel</button>}
        </div>
      </form>
      <div className="table-wrap cards">
        <table className="responsive">
          <thead><tr><th>Dealer</th><th>Company</th><th>Phone</th><th>Type</th><th className="r">Bills</th><th className="r">Total purchased</th><th /></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td data-label="Dealer">{d.name}</td><td data-label="Company">{d.company}</td><td data-label="Phone">{d.phone}</td>
                <td data-label="Type"><Badge tone={d.type === 'hardware' ? 'warn' : 'ok'}>{kindLabel(d.type)}</Badge></td>
                <td data-label="Bills" className="r">{d.bills}</td><td data-label="Total purchased" className="r">{fmt(d.total)}</td>
                <td className="r nowrap">
                  <button className="btn ghost sm" onClick={() => { setEditing(d.id); setF({ type: d.type, name: d.name, company: d.company, phone: d.phone }); window.scrollTo(0, 0); }}>Edit</button>{' '}
                  <button className="btn ghost sm danger" onClick={() => del(d)}>Delete</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="empty">No dealers yet. Register your first dealer above.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
