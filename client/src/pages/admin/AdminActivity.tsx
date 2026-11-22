import { useEffect, useState } from 'react';
import { api } from '../../api';
import { ACTION_LABEL, fmtDT } from '../../ui';
import type { Activity } from '../../types';

export default function AdminActivity() {
  const [rows, setRows] = useState<Activity[]>([]);
  useEffect(() => { api('/admin/activity').then(setRows); }, []);
  return (
    <>
      <h1>Activity (all shops)</h1>
      <div className="table-wrap"><table>
        <thead><tr><th>Time</th><th>Shop</th><th>By</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          {rows.map((a) => <tr key={a.id}><td className="nowrap">{fmtDT(a.created_at)}</td><td>{a.shop_name || 'System'}</td><td>{a.actor}</td><td>{ACTION_LABEL[a.action] || a.action}</td><td>{a.details}</td></tr>)}
          {!rows.length && <tr><td colSpan={5} className="empty">No activity yet.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
