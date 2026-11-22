import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Alert } from '../ui';

export default function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({ name: '', address: '', phone: '', password: '' });
  const [logo, setLogo] = useState<File | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const preview = logo ? URL.createObjectURL(logo) : '';
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.set(k, v));
    if (logo) fd.set('logo', logo);
    try { await register(fd); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h1>Register your shop</h1>
        <p className="muted">After registering, pay via HBL or JazzCash. Once the admin approves your payment, your access starts.</p>
        <Alert>{err}</Alert>
        <label>Shop name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label>Address<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required /></label>
        <label>Phone number (used to log in)<input inputMode="tel" placeholder="03001234567" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
        <label>Password (min 6 characters)<input type="password" minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
        <label>Shop logo (PNG/JPG, up to 2 MB)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] || null)} />
        </label>
        {preview && <img src={preview} alt="Logo preview" className="logo-preview" />}
        <button className="btn" disabled={busy}>{busy ? 'Registering...' : 'Register'}</button>
        <p className="muted center-text">Already have an account? <Link to="/">Login</Link></p>
      </form>
    </div>
  );
}
