import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { Badge } from '../ui';
import InstallApp from './InstallApp';

/* Simple outline icons for the mobile bottom bar */
const ICONS: Record<string, React.ReactNode> = {
  home: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  sales: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  box: <><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c3 0 5 2 5 5" /></>,
  shop: <><path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
};
const Icon = ({ name }: { name: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
);

type Link = [path: string, label: string, end?: boolean];
type Tab = [path: string, label: string, icon: string, end?: boolean];

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online ? null : <div className="offline-banner" role="status">You are offline. Reconnect to the internet to save or load data.</div>;
}

function Shell({ brand, miniBrand, links, tabs, top, children }: {
  brand: React.ReactNode; miniBrand: React.ReactNode; links: Link[]; tabs: Tab[]; top: React.ReactNode; children: React.ReactNode;
}) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);   // close the drawer after navigating
  return (
    <div className="shell">
      <div className={'scrim' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">{brand}</div>
        <nav>{links.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}</nav>
        <InstallApp />
        <button className="btn ghost logout" onClick={logout}>Logout</button>
      </aside>
      <div className="main">
        <OfflineBanner />
        <header className="top">
          <button className="menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <div className="top-brand">{miniBrand}</div>
          {top}
        </header>
        <main className="page">{children}</main>
      </div>
      <nav className="bottom-nav" aria-label="Main">
        {tabs.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end}><Icon name={icon} /><span>{label}</span></NavLink>)}
        <button onClick={() => setOpen(true)}><Icon name="menu" /><span>More</span></button>
      </nav>
    </div>
  );
}

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const { shop } = useAuth();
  if (!shop) return null;
  const restricted = shop.must_change || !shop.access;
  const links: Link[] = shop.must_change
    ? [['/profile', 'Change password']]
    : shop.access
      ? [['/', 'Dashboard', true], ['/sales', 'Sales'], ['/purchases', 'Purchases'], ['/customers', 'Customers'], ['/dealers', 'Dealers'], ['/activity', 'Activity'], ['/subscribe', 'Subscription'], ['/profile', 'Profile']]
      : [['/subscribe', 'Subscription'], ['/profile', 'Profile']];
  const tabs: Tab[] = restricted
    ? links.map(([p, l]) => [p, l, p === '/profile' ? 'users' : 'card'] as Tab)
    : [['/', 'Home', 'home', true], ['/sales', 'Sales', 'sales'], ['/purchases', 'Purchases', 'box'], ['/customers', 'Customers', 'users']];
  const logo = shop.logo ? <img src={shop.logo} alt="" className="logo" /> : <span className="logo ph">{shop.name[0]}</span>;
  return (
    <Shell
      brand={<>{logo}<div><strong>{shop.name}</strong><small>{shop.phone}</small></div></>}
      miniBrand={<>{logo}<strong>{shop.name}</strong></>}
      links={links} tabs={tabs}
      top={<>
        <span className="muted top-addr">{shop.address}</span>
        {shop.access ? <Badge tone={shop.daysLeft <= 5 ? 'warn' : 'ok'}>{shop.daysLeft} days left</Badge> : <Badge tone="bad">Subscription inactive</Badge>}
      </>}
    >{children}</Shell>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminName } = useAuth();
  return (
    <Shell
      brand={<><span className="logo ph">A</span><div><strong>Admin panel</strong><small>{adminName}</small></div></>}
      miniBrand={<><span className="logo ph">A</span><strong>Admin panel</strong></>}
      links={[['/admin', 'Overview', true], ['/admin/shops', 'Shops'], ['/admin/payments', 'Payments'], ['/admin/password-requests', 'Password Requests'], ['/admin/activity', 'Activity'], ['/admin/settings', 'Settings & Maintenance']]}
      tabs={[['/admin', 'Overview', 'home', true], ['/admin/shops', 'Shops', 'shop'], ['/admin/payments', 'Payments', 'card']]}
      top={<span className="muted top-addr">Software administration</span>}
    >{children}</Shell>
  );
}

export function GateScreen() {
  const { gate, refresh, logout } = useAuth();
  if (!gate) return null;
  const maint = gate.type === 'maintenance';
  return (
    <div className="center gate">
      <div className="card narrow">
        <div className="gate-icon">{maint ? '\u{1F6E0}' : '\u26D4'}</div>
        <h1>{maint ? 'Under maintenance' : 'Account blocked'}</h1>
        <p>{gate.message}</p>
        {maint && <button className="btn" onClick={refresh}>Check again</button>}
        <button className="btn ghost" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
