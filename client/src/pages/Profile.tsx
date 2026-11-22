import { FormEvent, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert } from '../ui';

export default function Profile() {
  const { shop, setShop } = useAuth();
  const [name, setName] = useState(shop!.name); const [address, setAddress] = useState(shop!.address);
  const [logo, setLogo] = useState<File | null>(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [pw, setPw] = useState({ current: '', password: '' }); const [pmsg, setPmsg] = useState(''); const [perr, setPerr] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault(); setMsg(''); setErr('');
    const fd = new FormData(); fd.set('name', name); fd.set('address', address); if (logo) fd.set('logo', logo);
    try { const d = await api('/shop/me', { method: 'PUT', form: fd }); setShop(d.shop); setLogo(null); setMsg('Profile saved'); }
    catch (e: any) { setErr(e.message); }
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault(); setPmsg(''); setPerr('');
    try { const d = await api('/shop/password', { body: pw }); setPw({ current: '', password: '' }); setPmsg('Password changed'); if (d.shop) setShop(d.shop); }
    catch (e: any) { setPerr(e.message); }
  };
  return (
    <>
      <h1>Shop profile</h1>
      {shop!.must_change && <Alert tone="warn">The administrator reset your password. Please choose a new password below to continue.</Alert>}
      <form className="card narrow-left" onSubmit={save}>
        {shop!.logo && <img src={shop!.logo} alt="Shop logo" className="logo-preview" />}
        <Alert>{err}</Alert><Alert tone="ok">{msg}</Alert>
        <label>Shop name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Address<input value={address} onChange={(e) => setAddress(e.target.value)} required /></label>
        <label>Phone (login ID, cannot be changed)<input value={shop!.phone} disabled /></label>
        <label>New logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] || null)} /></label>
        <button className="btn">Save changes</button>
      </form>
      <form className="card narrow-left" onSubmit={changePw}>
        <h2>Change password</h2>
        <Alert>{perr}</Alert><Alert tone="ok">{pmsg}</Alert>
        <label>Current password<input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></label>
        <label>New password (min 6 characters)<input type="password" minLength={6} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required /></label>
        <button className="btn">Change password</button>
      </form>
    </>
  );
}
