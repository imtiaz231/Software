import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Badge, fmtDT } from '../../ui';
import type { PasswordRequest } from '../../types';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const generate = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % ALPHABET.length]).join('');

export default function AdminPasswordRequests() {
  const [st, setSt] = useState('pending');
  const [rows, setRows] = useState<PasswordRequest[]>([]);
  const load = useCallback(() => api('/admin/password-requests' + (st ? '?status=' + st : '')).then(setRows), [st]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (r: PasswordRequest) => {
    const pw = prompt(
      `Set a temporary password for ${r.shop_name} (${r.shop_phone}).\nShare it with the shop owner by phone or WhatsApp. They will be asked to change it after logging in.`,
      generate()
    );
    if (!pw) return;
    try { await api(`/admin/password-requests/${r.id}/resolve`, { body: { password: pw } }); alert(`Done. New password for ${r.shop_name}: ${pw}`); load(); }
    catch (e: any) { alert(e.message); }
  };
  const dismiss = async (r: PasswordRequest) => {
    if (!confirm(`Dismiss the request from ${r.shop_name}?`)) return;
    try { await api(`/admin/password-requests/${r.id}/dismiss`, { body: {} }); load(); } catch (e: any) { alert(e.message); }
  };
  return (
    <>
      <h1>Password requests</h1>
      <p className="muted">You can also reset any shop's password at any time from the Shops page.</p>
      <div className="filters"><label>Status<select value={st} onChange={(e) => setSt(e.target.value)}><option value="pending">Pending</option><option value="done">Done</option><option value="dismissed">Dismissed</option><option value="">All</option></select></label></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Requested</th><th>Shop</th><th>Phone</th><th>Message</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="nowrap">{fmtDT(r.created_at)}</td><td>{r.shop_name}</td><td>{r.shop_phone}</td><td>{r.note || '-'}</td>
              <td><Badge tone={r.status === 'done' ? 'ok' : r.status === 'pending' ? 'warn' : 'mute'}>{r.status}</Badge>{r.resolved_at && <div className="muted small">{fmtDT(r.resolved_at)}</div>}</td>
              <td className="nowrap r">{r.status === 'pending' && <><button className="btn sm" onClick={() => resolve(r)}>Set new password</button>{' '}<button className="btn ghost sm danger" onClick={() => dismiss(r)}>Dismiss</button></>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="empty">No password requests.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
