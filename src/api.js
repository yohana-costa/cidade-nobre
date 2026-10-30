/* ============ API (fetch com token) ============ */
// Base da API: mesma origem (/api) em producao. Em desenvolvimento o servidor local
// (scripts/servidor-dev.mjs) repassa /api para o backend. Para apontar para outro endereco,
// defina window.CN_API_BASE antes de carregar este arquivo.
const API = {
  base: (window.CN_API_BASE || '/api').replace(/\/$/, ''),
  keys: { staff: 'cn-token-equipe', client: 'cn-token-cliente' },
  token(kind) { try { return localStorage.getItem(this.keys[kind]) || ''; } catch (e) { return ''; } },
  setToken(kind, t) { try { if (t) localStorage.setItem(this.keys[kind], t); else localStorage.removeItem(this.keys[kind]); } catch (e) { /* armazenamento indisponivel */ } },
  // auth: 'staff' | 'client' | null
  async req(method, path, body, auth) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const t = auth ? this.token(auth) : '';
    if (t) headers.Authorization = `Bearer ${t}`;
    let r;
    try {
      r = await fetch(this.base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw Object.assign(new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.'), { status: 0 });
    }
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    if (!r.ok) {
      const err = Object.assign(new Error((data && data.error) || `Erro ${r.status}. Tente de novo.`), { status: r.status, data });
      // sessao vencida: limpa o token e avisa o app para voltar ao login
      if (r.status === 401 && auth && t) { this.setToken(auth, ''); if (typeof onSessionLost === 'function') onSessionLost(auth); }
      throw err;
    }
    return data;
  },
  get(p, auth) { return this.req('GET', p, undefined, auth); },
  post(p, b, auth) { return this.req('POST', p, b || {}, auth); },
  put(p, b, auth) { return this.req('PUT', p, b || {}, auth); },
  patch(p, b, auth) { return this.req('PATCH', p, b || {}, auth); },
  del(p, auth) { return this.req('DELETE', p, undefined, auth); },
};
