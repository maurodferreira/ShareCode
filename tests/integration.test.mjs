import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { startServer } from '../server/index.mjs';

async function withServer(run) {
  const actions = [];
  const opencode = {
    status: async () => ({ version: '2.1.4', ready: true }),
    projects: async () => [{ id: 'project1' }],
    sessions: async () => ({ items: [{ id: 'ses_12345', title: 'Projeto' }] }),
    messages: async (id) => ({ items: [{ info: { type: 'assistant' }, parts: [{ type: 'text', text: id }] }] }),
    createSession: async (title) => ({ id: 'ses_12345', title }),
    prompt: async (id, text) => { actions.push({ id, text }); return { ok: true }; }
  };
  const server = startServer({ SHARECODE_PASSWORD: 'UmaSenhaFortissima!123', SHARECODE_HOST: '127.0.0.1', SHARECODE_PORT: '0' }, { opencode });
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`, actions); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('autenticacao, API allowlist e origem', async () => withServer(async (url, actions) => {
  const unauth = await fetch(`${url}/api/sessions`);
  assert.equal(unauth.status, 401);
  const wrongOrigin = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://atacante.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'UmaSenhaFortissima!123' }) });
  assert.equal(wrongOrigin.status, 403);
  const response = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'UmaSenhaFortissima!123' }) });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const sessions = await fetch(`${url}/api/sessions`, { headers: { Cookie: cookie } });
  assert.equal(sessions.status, 200);
  const payload = await sessions.json();
  assert.equal(payload.result.items[0].id, 'ses_12345');
  const prompt = await fetch(`${url}/api/sessions/ses_12345/prompt`, { method: 'POST', headers: { Cookie: cookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Criar testes' }) });
  assert.equal(prompt.status, 200);
  assert.deepEqual(actions, [{ id: 'ses_12345', text: 'Criar testes' }]);
  const blocked = await fetch(`${url}/api/anything`, { headers: { Cookie: cookie } });
  assert.equal(blocked.status, 404);
  const index = await fetch(url);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-security-policy'), /frame-ancestors 'none'/);
}));
