import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AdminLayout, GateScreen, ShopLayout } from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Forgot from './pages/Forgot';
import Dashboard from './pages/Dashboard';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Dealers from './pages/Dealers';
import Customers from './pages/Customers';
import CustomerAccount from './pages/CustomerAccount';
import ActivityPage from './pages/Activity';
import Subscribe from './pages/Subscribe';
import Profile from './pages/Profile';
import AdminOverview from './pages/admin/Overview';
import AdminShops from './pages/admin/Shops';
import AdminPayments from './pages/admin/Payments';
import AdminPasswordRequests from './pages/admin/PasswordRequests';
import AdminActivity from './pages/admin/AdminActivity';
import AdminSettings from './pages/admin/Settings';

export default function App() {
  const { role, shop, loading, gate } = useAuth();
  if (loading) return <div className="center muted">Loading...</div>;
  if (gate) return <GateScreen />;
  if (!role) return <Routes><Route path="/register" element={<Register />} /><Route path="/forgot" element={<Forgot />} /><Route path="*" element={<Login />} /></Routes>;
  if (role === 'admin') {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/shops" element={<AdminShops />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/password-requests" element={<AdminPasswordRequests />} />
          <Route path="/admin/activity" element={<AdminActivity />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminLayout>
    );
  }
  if (!shop) return <div className="center muted">Loading...</div>;
  if (shop.must_change) {
    return (
      <ShopLayout>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
      </ShopLayout>
    );
  }
  return (
    <ShopLayout>
      <Routes>
        {shop.access && <Route path="/" element={<Dashboard />} />}
        {shop.access && <Route path="/purchases" element={<Purchases />} />}
        {shop.access && <Route path="/sales" element={<Sales />} />}
        {shop.access && <Route path="/dealers" element={<Dealers />} />}
        {shop.access && <Route path="/customers" element={<Customers />} />}
        {shop.access && <Route path="/customers/:id" element={<CustomerAccount />} />}
        {shop.access && <Route path="/activity" element={<ActivityPage />} />}
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to={shop.access ? '/' : '/subscribe'} replace />} />
      </Routes>
    </ShopLayout>
  );
}
