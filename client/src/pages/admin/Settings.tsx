import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../api';
import { Alert } from '../../ui';

type S = Record<string, string>;

export default function AdminSettings() {
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [pw, setPw] = useState({ current: '', password: '' }); const [pmsg, setPmsg] = useState(''); const [perr, setPerr] = useState('');
  useEffect(() => { api('/admin/settings').then(setS); }, []);
  if (!s) return <p className="muted">Loading...</p>;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });
  const on = s.maintenance_mode === '1';

  const save = async (patch: S, ok = 'Settings saved') => {
    setMsg(''); setErr('');
    try { setS(await api('/admin/settings', { method: 'PUT', body: patch })); setMsg(ok); } catch (e: any) { setErr(e.message); }
  };
  const toggleMaint = () => {
    if (!on && !confirm('Turning maintenance ON stops all shops from using the software. Continue?')) return;
    save({ maintenance_mode: on ? '0' : '1', maintenance_message: s.maintenance_message }, on ? 'Maintenance is OFF. Shops can use the software again.' : 'Maintenance is ON.');
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault(); setPmsg(''); setPerr('');
    try { await api('/admin/password', { body: pw }); setPw({ current: '', password: '' }); setPmsg('Admin password changed'); } catch (e: any) { setPerr(e.message); }
  };
  return (
    <>
      <h1>Settings & Maintenance</h1>
      <Alert>{err}</Alert><Alert tone="ok">{msg}</Alert>
      <section className={'card maint ' + (on ? 'on' : '')}>
        <h2>Maintenance mode: {on ? 'ON' : 'OFF'}</h2>
        <p className="muted">Turn this on while you fix an account or software issue. Shops will see your message and the admin panel keeps working.</p>
        <label>Message shown to shops<textarea rows={2} value={s.maintenance_message} onChange={set('maintenance_message')} /></label>
        <button className={'btn ' + (on ? '' : 'danger-solid')} onClick={toggleMaint}>{on ? 'Turn maintenance OFF' : 'Turn maintenance ON'}</button>
      </section>

      <form className="card" onSubmit={(e) => { e.preventDefault(); const { maintenance_mode, maintenance_message, ...rest } = s; save(rest); }}>
        <h2>Pricing and payment accounts</h2>
        <div className="cols">
          <label>Price per month (Rs)<input type="number" min="0" value={s.price_per_month} onChange={set('price_per_month')} /></label>
          <label>Support phone<input value={s.support_phone} onChange={set('support_phone')} /></label>
        </div>
        <div className="cols">
          <label>HBL account title<input value={s.hbl_title} onChange={set('hbl_title')} /></label>
          <label>HBL account no / IBAN<input value={s.hbl_account} onChange={set('hbl_account')} /></label>
        </div>
        <div className="cols">
          <label>JazzCash account title<input value={s.jazzcash_title} onChange={set('jazzcash_title')} /></label>
          <label>JazzCash number<input value={s.jazzcash_number} onChange={set('jazzcash_number')} /></label>
        </div>
        <button className="btn">Save settings</button>
      </form>

      <form className="card narrow-left" onSubmit={changePw}>
        <h2>Change admin password</h2>
        <Alert>{perr}</Alert><Alert tone="ok">{pmsg}</Alert>
        <label>Current password<input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></label>
        <label>New password (min 8 characters)<input type="password" minLength={8} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required /></label>
        <button className="btn">Change password</button>
      </form>
    </>
  );
}
