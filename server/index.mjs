import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAuth } from './auth.mjs';
import { createOpencode } from './opencode.mjs';
import { createDesktopChannel } from './desktop.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/desktop.js', ['desktop.js', 'text/javascript; charset=utf-8']],
  ['/mobile.css', ['mobile.css', 'text/css; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json; charset=utf-8']]
]);
const sessionIdPattern = /^[a-zA-Z0-9_-]{4,128}$/;
const policies = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'same-origin'
};
function json(res, status, body, extra = {}) {
  res.writeHead(status, { ...policies, 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(body));
}
async function bodyJson(req) {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw Object.assign(new Error('Envie JSON.'), { status: 415 });
  let size = 0;
  const parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > 32768) throw Object.assign(new Error('Requisição muito grande.'), { status: 413 });
    parts.push(part);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}
function validOrigin(req, externalOrigin) {
  const origin = req.headers.origin;
  if (!origin) return false;
  if (externalOrigin && origin === externalOrigin) return true;
  const hostname = (req.headers.host || '').split(':')[0].toLowerCase();
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return false;
  return origin === `http://${req.headers.host}`;
}
function validHost(req, externalOrigin) {
  const actual = (req.headers.host || '').toLowerCase();
  const publicHost = externalOrigin ? new URL(externalOrigin).host.toLowerCase() : null;
  return actual === publicHost || /^localhost(?::\d+)?$/.test(actual) || /^127\.0\.0\.1(?::\d+)?$/.test(actual);
}
export function startServer(env = process.env, opts = {}) {
  const auth = createAuth(env.SHARECODE_PASSWORD);
  const desktop = createDesktopChannel();
  const opencode = opts.opencode ?? createOpencode(env);
  const publicOrigin = env.SHARECODE_PUBLIC_ORIGIN?.replace(/\/$/, '') || null;
  if (publicOrigin && (new URL(publicOrigin).protocol !== 'https:' || new URL(publicOrigin).pathname !== '/')) {
    throw new Error('SHARECODE_PUBLIC_ORIGIN deve ser uma origem HTTPS sem caminhos.');
  }
  const secure = !!publicOrigin;
  const hostname = env.SHARECODE_HOST || '127.0.0.1';
  const port = Number(env.SHARECODE_PORT || 4177);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Porta inválida.');
  const server = http.createServer(async (req, res) => {
    try {
      if (!validHost(req, publicOrigin)) return json(res, 421, { error: 'Host não autorizado.' });
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (req.method === 'POST' && !validOrigin(req, publicOrigin)) return json(res, 403, { error: 'Origem não autorizada.' });
      if (req.method === 'GET' && assets.has(pathname)) {
        const [name, mime] = assets.get(pathname);
        const content = await fs.readFile(path.join(root, name));
        res.writeHead(200, { ...policies, 'Content-Type': mime, 'Cache-Control': pathname === '/sw.js' ? 'no-cache' : 'no-store' });
        return res.end(content);
      }
      if (pathname === '/api/auth/status' && req.method === 'GET') return json(res, 200, { authenticated: auth.isAuthenticated(req.headers.cookie) });
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const input = await bodyJson(req);
        const attempt = auth.login(input?.password, req.socket.remoteAddress || 'unknown');
        if (!attempt.ok) return json(res, attempt.locked ? 429 : 401, { error: attempt.locked ? 'Muitas tentativas. Tente novamente em 15 minutos.' : 'Senha inválida.' });
        return json(res, 200, { authenticated: true }, { 'Set-Cookie': auth.cookie(attempt.token, secure) });
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        auth.logout(req.headers.cookie);
        return json(res, 200, { authenticated: false }, { 'Set-Cookie': auth.clearCookie(secure) });
      }
      if (pathname.startsWith('/api/')) {
        if (!auth.isAuthenticated(req.headers.cookie)) return json(res, 401, { error: 'Faça login.' });
        if (pathname.startsWith('/api/desktop/')) {
          const handled = await desktop.handle(req, res, pathname);
          if (handled !== false) return;
          return json(res, 404, { error: 'Rota inexistente.' });
        }
        let data;
        if (pathname === '/api/system/status' && req.method === 'GET') data = await opencode.status();
        else if (pathname === '/api/projects' && req.method === 'GET') data = await opencode.projects();
        else if (pathname === '/api/sessions' && req.method === 'GET') data = await opencode.sessions();
        else if (pathname === '/api/sessions' && req.method === 'POST') {
          const input = await bodyJson(req);
          if (typeof input?.title !== 'string' || !input.title.trim() || input.title.length > 120) return json(res, 400, { error: 'Título inválido.' });
          data = await opencode.createSession(input.title.trim());
        } else {
          const message = pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
          const prompt = pathname.match(/^\/api\/sessions\/([^/]+)\/prompt$/);
          if (message && req.method === 'GET' && sessionIdPattern.test(message[1])) data = await opencode.messages(message[1]);
          else if (prompt && req.method === 'POST' && sessionIdPattern.test(prompt[1])) {
            const input = await bodyJson(req);
            if (typeof input?.text !== 'string' || !input.text.trim() || input.text.length > 12000) return json(res, 400, { error: 'Mensagem deve ter entre 1 e 12.000 caracteres.' });
            data = await opencode.prompt(prompt[1], input.text.trim());
          } else return json(res, 404, { error: 'Rota inexistente.' });
        }
        return json(res, 200, { result: data });
      }
      return json(res, 404, { error: 'Não encontrado.' });
    } catch (error) {
      const code = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : error.name === 'TimeoutError' ? 504 : 502;
      // Não vazar URLs, tokens, mensagens internas nem stack traces do serviço.
      const publicMessage = code === 502 ? 'OpenCode indisponível ou erro de comunicação. Confira se o serviço está ligado.' : (code === 504 ? 'O OpenCode demorou demais a responder.' : error.message);
      json(res, code, { error: publicMessage });
    }
  });
  server.listen(port, hostname);
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = startServer();
    server.on('listening', () => console.log(`ShareCode local: http://${server.address().address}:${server.address().port} — acesso remoto exige túnel privado HTTPS.`));
  } catch (error) { console.error(`Falha na inicialização: ${error.message}`); process.exitCode = 1; }
}
