import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import type { Shop } from './types';

type Role = 'admin' | 'shop' | null;
export type Gate = { type: 'maintenance' | 'blocked'; message: string } | null;
interface Ctx {
  role: Role; shop: Shop | null; adminName: string; loading: boolean; gate: Gate;
  login(identifier: string, password: string): Promise<void>;
  register(form: FormData): Promise<void>;
  logout(): void; refresh(): Promise<void>; setShop(s: Shop): void;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(C);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>((localStorage.getItem('role') as Role) || null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(!!getToken());
  const [gate, setGate] = useState<Gate>(null);

  const logout = useCallback(() => {
    setToken(''); localStorage.removeItem('role');
    setRole(null); setShop(null); setGate(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      if (localStorage.getItem('role') === 'admin') {
        const d = await api('/admin/me'); setAdminName(d.username); setRole('admin');
      } else {
        const d = await api('/shop/me'); setShop(d.shop); setRole('shop'); setGate(null);
      }
    } catch (e: any) { if (e.status === 401) logout(); }
    finally { setLoading(false); }
  }, [logout]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const expired = () => logout();
    const onGate = (ev: Event) => {
      const { status, data } = (ev as CustomEvent).detail;
      if (status === 503) setGate({ type: 'maintenance', message: data.error });
      else if (status === 403 && data.blocked) setGate({ type: 'blocked', message: data.error });
      else if (status === 402) refresh();
    };
    window.addEventListener('auth:expired', expired);
    window.addEventListener('auth:gate', onGate);
    return () => { window.removeEventListener('auth:expired', expired); window.removeEventListener('auth:gate', onGate); };
  }, [logout, refresh]);

  const finish = (d: any) => {
    setToken(d.token); localStorage.setItem('role', d.role); setRole(d.role);
    if (d.role === 'shop') setShop(d.shop); else setAdminName(d.admin.username);
  };
  const login = async (identifier: string, password: string) => finish(await api('/auth/login', { body: { identifier, password } }));
  const register = async (form: FormData) => finish(await api('/auth/register', { form }));

  return <C.Provider value={{ role, shop, adminName, loading, gate, login, register, logout, refresh, setShop }}>{children}</C.Provider>;
}
