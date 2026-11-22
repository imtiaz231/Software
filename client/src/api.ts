let token = localStorage.getItem('token') || '';
export const getToken = () => token;
export const setToken = (t: string) => { token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); };

export class ApiError extends Error {
  status: number; data: any;
  constructor(m: string, s: number, d: any) { super(m); this.status = s; this.data = d; }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  let res: Response;
  try { res = await fetch('/api' + path, { method: opts.method || (body ? 'POST' : 'GET'), headers, body }); }
  catch { throw new ApiError('Cannot reach the server. Please check your internet connection and try again.', 0, {}); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (token) {
      if (res.status === 401) window.dispatchEvent(new Event('auth:expired'));
      else if ([402, 403, 503].includes(res.status)) window.dispatchEvent(new CustomEvent('auth:gate', { detail: { status: res.status, data } }));
    }
    throw new ApiError(data.error || 'Something went wrong', res.status, data);
  }
  return data as T;
}

/* Downloads a private file (e.g. a bill photo) with the login token and returns it as a Blob */
export async function apiBlob(path: string): Promise<Blob> {
  let res: Response;
  try { res = await fetch('/api' + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} }); }
  catch { throw new ApiError('Cannot reach the server. Please check your internet connection and try again.', 0, {}); }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(d.error || 'Could not load the image', res.status, d); }
  return res.blob();
}
