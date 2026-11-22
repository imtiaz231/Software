import React from 'react';

export const fmt = (n: number | string | null | undefined) =>
  'Rs ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
export const fmtDate = (d?: string | null) =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
export const fmtDT = (d: string) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const monthsLabel = (n: number) => `${n} month${n === 1 ? '' : 's'}`;
export const kindLabel = (k: string) => (k === 'hardware' ? 'Hardware' : 'Electronic');

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className={'stat ' + (tone || '')}>
      <div className="stat-l">{label}</div>
      <div className="stat-v">{value}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}
export const Badge = ({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'mute'; children: React.ReactNode }) => (
  <span className={'badge ' + tone}>{children}</span>
);
export const Alert = ({ children, tone = 'bad' }: { children: React.ReactNode; tone?: 'bad' | 'ok' | 'warn' }) =>
  children ? <div className={'alert ' + tone}>{children}</div> : null;

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button type="button" key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}
export const ACTION_LABEL: Record<string, string> = {
  register: 'Shop registered', login: 'Login', profile_update: 'Profile updated', password_change: 'Password changed', password_request: 'Password reset requested',
  payment_submitted: 'Payment submitted', payment_approved: 'Payment approved', payment_rejected: 'Payment rejected',
  dealer_add: 'Dealer added', dealer_edit: 'Dealer edited', dealer_delete: 'Dealer deleted',
  purchase_add: 'Purchase bill added', purchase_image: 'Bill photo attached', sale_add: 'Sale bill added', access_granted: 'Access granted', access_revoked: 'Access revoked',
  shop_blocked: 'Shop blocked', shop_unblocked: 'Shop unblocked', password_reset: 'Password reset by admin',
  customer_add: 'Customer added', customer_edit: 'Customer edited', customer_delete: 'Customer deleted',
  credit_add: 'Credit given to customer', payment_add: 'Payment received from customer', entry_void: 'Ledger entry voided',
  maintenance_on: 'Maintenance ON', maintenance_off: 'Maintenance OFF',
};
