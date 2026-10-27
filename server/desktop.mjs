import { randomBytes, timingSafeEqual } from 'node:crypto';

const FRAME_LIMIT = 220_000;
const FRAME_TTL = 15_000;

export function createDesktopChannel(now = Date.now) {
  let owner = null;
  let frame = null;
  let updatedAt = 0;

  function active() {
    if (frame && now() - updatedAt > FRAME_TTL) { frame = null; owner = null; }
    return !!frame;
  }
  function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  }
  function valid(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !owner) return false;
    return timingSafeEqual(Buffer.from(token), Buffer.from(owner));
  }
  async function handle(req, res, route) {
    if (route === '/api/desktop/status' && req.method === 'GET') {
      return send(res, 200, { sharing: active(), lastFrameAt: active() ? updatedAt : null });
    }
    if (route === '/api/desktop/frame' && req.method === 'GET') {
      if (!active()) return send(res, 404, { error: 'Nenhuma tela sendo compartilhada.' });
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': frame.length, 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' });
      res.end(frame);
      return;
    }
    if (route === '/api/desktop/start' && req.method === 'POST') {
      // A tela só é capturada após consentimento explícito pelo navegador no computador.
      if (owner && active()) return send(res, 409, { error: 'Já há uma transmissão ativa.' });
      owner = randomBytes(32).toString('hex');
      frame = null;
      updatedAt = 0;
      return send(res, 200, { token: owner });
    }
    if ((route === '/api/desktop/frame' || route === '/api/desktop/stop') && req.method === 'POST') {
      if (!valid(req.headers['x-sharecode-stream-token'])) return send(res, 403, { error: 'Transmissão não autorizada.' });
      if (route === '/api/desktop/stop') {
        owner = null; frame = null; updatedAt = 0;
        return send(res, 200, { stopped: true });
      }
      if (req.headers['content-type'] !== 'image/jpeg') return send(res, 415, { error: 'Somente JPEG.' });
      let count = 0;
      const chunks = [];
      for await (const part of req) {
        count += part.length;
        if (count > FRAME_LIMIT) return send(res, 413, { error: 'Imagem muito grande.' });
        chunks.push(part);
      }
      const data = Buffer.concat(chunks);
      if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 || data.at(-2) !== 0xff || data.at(-1) !== 0xd9) return send(res, 400, { error: 'JPEG inválido.' });
      frame = data;
      updatedAt = now();
      return send(res, 200, { ok: true });
    }
    return false;
  }
  return { handle };
}
