// Ligação ao servidor. Todos os pedidos levam o cabeçalho X-LPJ (proteção contra pedidos de outros sites).
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'X-LPJ': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Sem ligação ao servidor. Confirma a internet e tenta de novo.');
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized();
    throw new ApiError(res.status, data?.error || 'Ocorreu um erro. Tenta de novo.', data);
  }
  return data;
}

export const get = (p, o) => api(p, o);
export const post = (p, body) => api(p, { method: 'POST', body: body ?? {} });
export const put = (p, body) => api(p, { method: 'PUT', body: body ?? {} });
export const del = (p) => api(p, { method: 'DELETE', body: {} });

// Lê um ficheiro escolhido pela pessoa como data URL (para enviar em JSON).
export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
  r.readAsDataURL(file);
});
