import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Badge, fmt, fmtDT, monthsLabel } from '../../ui';
import type { Payment } from '../../types';

export default function AdminPayments() {
  const [st, setSt] = useState('pending');
  const [rows, setRows] = useState<Payment[]>([]);
  const load = useCallback(() => api('/admin/payments' + (st ? '?status=' + st : '')).then(setRows), [st]);
  useEffect(() => { load(); }, [load]);

  const approve = async (p: Payment) => {
    if (!confirm(`Approve ${fmt(p.amount)} (${monthsLabel(p.months)}) from ${p.shop_name}? Please check your HBL/JazzCash account first.`)) return;
    try { await api(`/admin/payments/${p.id}/approve`, { method: 'POST', body: {} }); load(); } catch (e: any) { alert(e.message); }
  };
  const reject = async (p: Payment) => {
    const note = prompt('Reason for rejection (the shop will see this)'); if (note === null) return;
    try { await api(`/admin/payments/${p.id}/reject`, { method: 'POST', body: { note } }); load(); } catch (e: any) { alert(e.message); }
  };
  return (
    <>
      <h1>Payments</h1>
      <div className="filters"><label>Status<select value={st} onChange={(e) => setSt(e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option></select></label></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Shop</th><th>Method</th><th>Duration</th><th className="r">Amount</th><th>Reference</th><th>Screenshot</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="nowrap">{fmtDT(p.created_at)}</td><td>{p.shop_name}<div className="muted small">{p.shop_phone}</div></td>
              <td>{p.method}</td><td>{monthsLabel(p.months)}</td><td className="r">{fmt(p.amount)}</td><td>{p.txn_ref}</td>
              <td>{p.screenshot ? <a href={'/uploads/' + p.screenshot} target="_blank" rel="noreferrer">View</a> : '-'}</td>
              <td><Badge tone={p.status === 'approved' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad'}>{p.status}</Badge>{p.note && <div className="muted small">{p.note}</div>}</td>
              <td className="nowrap">{p.status === 'pending' && <><button className="btn sm" onClick={() => approve(p)}>Approve</button>{' '}<button className="btn ghost sm danger" onClick={() => reject(p)}>Reject</button></>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9} className="empty">No payments found.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
