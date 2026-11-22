import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Alert, fmt, Stat } from '../../ui';

export default function AdminOverview() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/admin/stats').then(setS); }, []);
  if (!s) return <p className="muted">Loading...</p>;
  return (
    <>
      <h1>Overview</h1>
      {s.maintenance && <Alert tone="warn">Maintenance mode is ON. Shops cannot use the software right now. <Link to="/admin/settings">Open settings</Link></Alert>}
      {s.password_requests > 0 && <Alert tone="warn">{s.password_requests} shop(s) asked for a password reset. <Link to="/admin/password-requests">Review requests</Link></Alert>}
      {s.pending_payments > 0 && <Alert tone="warn">{s.pending_payments} payment(s) waiting for approval. <Link to="/admin/payments">Review payments</Link></Alert>}
      <div className="grid">
        <Stat label="Total shops" value={s.total} />
        <Stat label="Active" value={s.active} tone="good" sub={`${s.expiring_soon} expiring within 7 days`} />
        <Stat label="Expired" value={s.expired} />
        <Stat label="Never paid" value={s.never_paid} />
        <Stat label="Blocked" value={s.blocked} />
        <Stat label="Income this month" value={fmt(s.revenue_month)} tone="accent" sub={`All time: ${fmt(s.revenue_total)}`} />
      </div>
    </>
  );
}
