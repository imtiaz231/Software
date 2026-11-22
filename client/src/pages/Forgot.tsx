import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Alert } from '../ui';

export default function Forgot() {
  const [phone, setPhone] = useState(''); const [note, setNote] = useState('');
  const [done, setDone] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const d = await api('/auth/forgot-password', { body: { phone, note } }); setDone(d.message); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h1>Forgot password</h1>
        {done ? (
          <>
            <Alert tone="ok">{done}</Alert>
            <p className="muted">The admin will set a temporary password and share it with you. You will be asked to choose your own password after you log in.</p>
            <Link className="btn" to="/">Back to login</Link>
          </>
        ) : (
          <>
            <p className="muted">Enter the phone number you registered with. The administrator will receive your request and set a new password for you.</p>
            <Alert>{err}</Alert>
            <label>Registered phone number<input inputMode="tel" placeholder="03001234567" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
            <label>Message for the admin (optional)<input maxLength={200} placeholder="e.g. Please call me on this number" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Send reset request'}</button>
            <p className="muted center-text"><Link to="/">Back to login</Link></p>
          </>
        )}
      </form>
    </div>
  );
}
