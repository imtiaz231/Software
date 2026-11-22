import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { fmt, fmtDate, Stat } from '../ui';

interface Sum { count: number; total: number; profit?: number }
interface Summary { receivable: { total: number; customers: number }; today: { purchases: Sum; sales: Sum }; month: { purchases: Sum; sales: Sum }; all: { purchases: Sum; sales: Sum } }
interface Day { date: string; sale_count: number; sales: number; profit: number; purchase_count: number; purchases: number }

export default function Dashboard() {
  const [s, setS] = useState<Summary | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  useEffect(() => { api('/summary').then(setS); api('/reports/daily').then(setDays); }, []);
  if (!s) return <p className="muted">Loading...</p>;
  const Block = ({ title, d }: { title: string; d: Summary['today'] }) => (
    <section>
      <h2>{title}</h2>
      <div className="grid">
        <Stat label="Sales" value={fmt(d.sales.total)} sub={`${d.sales.count} bills`} />
        <Stat label="Profit" value={fmt(d.sales.profit)} tone="good" />
        <Stat label="Purchases" value={fmt(d.purchases.total)} sub={`${d.purchases.count} bills`} />
      </div>
    </section>
  );
  return (
    <>
      <h1>Dashboard</h1>
      <Block title="Today" d={s.today} />
      <section>
        <h2>Customer dues (udhaar)</h2>
        <div className="grid">
          <Stat label="Total owed by customers" value={fmt(s.receivable.total)} sub={`${s.receivable.customers} customer(s) with a balance`} tone={s.receivable.total > 0 ? 'accent' : 'good'} />
        </div>
        <Link className="btn ghost" to="/customers">Open customer accounts</Link>
      </section>
      <Block title="This month" d={s.month} />
      <Block title="All time" d={s.all} />
      <section>
        <h2>Daily summary - last 30 days</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th className="r">Sale bills</th><th className="r">Sales</th><th className="r">Profit</th><th className="r">Purchases</th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}><td>{fmtDate(d.date)}</td><td className="r">{d.sale_count}</td><td className="r">{fmt(d.sales)}</td><td className="r good">{fmt(d.profit)}</td><td className="r">{fmt(d.purchases)}</td></tr>
              ))}
              {!days.length && <tr><td colSpan={5} className="empty">No bills yet. Start by adding a sale or a purchase.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
