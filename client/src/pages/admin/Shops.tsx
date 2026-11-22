import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Badge, fmtDate } from '../../ui';
import type { Shop } from '../../types';

type Row = Shop & { sales_count: number; purchase_count: number };

export default function AdminShops() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const load = useCallback(() => api('/admin/shops?q=' + encodeURIComponent(q)).then(setRows), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const act = async (path: string, body?: unknown, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try { await api(path, { method: 'POST', body: body ?? {} }); load(); } catch (e: any) { alert(e.message); }
  };
  const addMonths = (s: Row) => { const m = prompt('How many months of access to add? (1-60)', '3'); if (m) act(`/admin/shops/${s.id}/grant`, { months: Number(m) }); };
  const addDays = (s: Row) => { const d = prompt('How many days of access to add?', '7'); if (d) act(`/admin/shops/${s.id}/grant`, { days: Number(d) }); };
  const reset = (s: Row) => { const p = prompt(`New password for ${s.name} (min 6 characters)`); if (p) act(`/admin/shops/${s.id}/reset-password`, { password: p }); };

  return (
    <>
      <h1>Shops</h1>
      <div className="filters"><label>Search<input placeholder="Name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Shop</th><th>Phone</th><th>Status</th><th>Expiry</th><th className="r">Sale / Purchase bills</th><th>Grant access</th><th /></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td><div className="cell-shop">{s.logo ? <img src={s.logo} alt="" className="mini-logo" /> : <span className="mini-logo ph">{s.name[0]}</span>}<div><b>{s.name}</b><div className="muted small">{s.address}</div></div></div></td>
              <td>{s.phone}</td>
              <td>{s.status === 'blocked' ? <Badge tone="bad">Blocked</Badge> : s.access ? <Badge tone="ok">Active</Badge> : s.expires_at ? <Badge tone="warn">Expired</Badge> : <Badge tone="mute">Unpaid</Badge>}</td>
              <td className="nowrap">{fmtDate(s.expires_at)}{s.access && <div className="muted small">{s.daysLeft} days left</div>}</td>
              <td className="r">{s.sales_count} / {s.purchase_count}</td>
              <td className="nowrap">
                <button className="btn sm" onClick={() => act(`/admin/shops/${s.id}/grant`, { months: 1 })}>+1 month</button>{' '}
                <button className="btn sm" onClick={() => addMonths(s)}>+ Months</button>{' '}
                <button className="btn ghost sm" onClick={() => addDays(s)}>+ Days</button>
              </td>
              <td className="nowrap r">
                <button className="btn ghost sm" onClick={() => reset(s)}>Reset password</button>{' '}
                {s.access && <button className="btn ghost sm danger" onClick={() => act(`/admin/shops/${s.id}/revoke`, {}, `Revoke access for ${s.name} now?`)}>Revoke access</button>}{' '}
                <button className="btn ghost sm danger" onClick={() => act(`/admin/shops/${s.id}/status`, { status: s.status === 'blocked' ? 'active' : 'blocked' }, s.status === 'blocked' ? undefined : `Block ${s.name}?`)}>{s.status === 'blocked' ? 'Unblock' : 'Block'}</button>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="empty">No shops found.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
