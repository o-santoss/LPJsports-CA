// Router muito simples: método + caminho com parâmetros (/api/users/:id).
// Cada rota diz quem a pode usar: 'public', 'user' (sessão ativa) ou a chave de um papel (ex.: 'ca').

export function createRouter() {
  const routes = [];
  const add = (method, path, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + path.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handler, access: opts.access ?? 'user', limit: opts.limit });
  };
  return {
    get: (p, h, o) => add('GET', p, h, o),
    post: (p, h, o) => add('POST', p, h, o),
    put: (p, h, o) => add('PUT', p, h, o),
    patch: (p, h, o) => add('PATCH', p, h, o),
    del: (p, h, o) => add('DELETE', p, h, o),
    match(method, path) {
      let allowed = false;
      for (const r of routes) {
        const m = path.match(r.re);
        if (!m) continue;
        if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) { allowed = true; continue; }
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, params };
      }
      return allowed ? { notAllowed: true } : null;
    },
  };
}
