function localOpencodeUrl(value) {
  const url = new URL(value || 'http://127.0.0.1:4096');
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('OPENCODE_URL deve ser um servidor HTTP local (localhost/127.0.0.1), sem caminhos.');
  }
  return url.origin;
}

export function createOpencode(env = process.env) {
  const baseUrl = localOpencodeUrl(env.OPENCODE_URL);
  const password = env.OPENCODE_SERVER_PASSWORD;
  const username = env.OPENCODE_SERVER_USERNAME || 'opencode';
  if (!password) throw new Error('OPENCODE_SERVER_PASSWORD é obrigatório; proteja o servidor OpenCode.');
  const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  async function request(path, method = 'GET', body) {
    const response = await fetch(new URL(path, baseUrl), {
      method,
      headers: { Authorization: auth, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(method === 'GET' ? 10000 : 20000),
      redirect: 'error'
    });
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new Error('Resposta do OpenCode muito grande.');
    let data;
    try { data = raw ? JSON.parse(raw) : null; }
    catch { throw new Error(`Resposta não JSON do OpenCode (${response.status}).`); }
    if (!response.ok) {
      const error = new Error(`OpenCode respondeu HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }
  return {
    status: () => request('/api/info'),
    projects: () => request('/api/project'),
    sessions: () => request('/api/session?limit=50&order=desc'),
    messages: (id) => request(`/api/session/${encodeURIComponent(id)}/message?limit=100&order=asc`),
    createSession: (title) => request('/api/session', 'POST', { title }),
    prompt: (id, text) => request(`/api/session/${encodeURIComponent(id)}/prompt`, 'POST', { text })
  };
}
