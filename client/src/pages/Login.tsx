import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Alert } from '../ui';
import InstallApp from '../components/InstallApp';

export default function Login() {
  const { login } = useAuth();
  const [id, setId] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [maint, setMaint] = useState('');
  useEffect(() => { fetch('/api/public/status').then((r) => r.json()).then((d) => d.maintenance && setMaint(d.message)).catch(() => {}); }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(id, pw); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h1>Shop Manager</h1>
        <p className="muted">Track purchases, sales and profit for your hardware and electronic shop.</p>
        <Alert tone="warn">{maint}</Alert>
        <Alert>{err}</Alert>
        <label>Phone number (admins: username)<input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></label>
        <button className="btn" disabled={busy}>{busy ? 'Logging in...' : 'Login'}</button>
        <p className="center-text"><Link to="/forgot">Forgot your password?</Link></p>
        <InstallApp />
        <p className="muted center-text">New here? <Link to="/register">Register your shop</Link></p>
      </form>
    </div>
  );
}
