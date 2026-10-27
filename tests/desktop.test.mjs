import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { startServer } from '../server/index.mjs';

async function setup(fn) {
  const server = startServer({ SHARECODE_PASSWORD: 'UmaSenhaFortissima!123', SHARECODE_HOST: '127.0.0.1', SHARECODE_PORT: '0' }, {opencode: {status: async () => ({version:'2.1.4'})}});
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(url+'/api/auth/login', { method: 'POST', headers: {Origin: url, 'Content-Type': 'application/json'}, body:JSON.stringify({password:'UmaSenhaFortissima!123'})});
    const cookie = login.headers.get('set-cookie').split(';')[0];
    await fn(url, cookie);
  } finally { await new Promise(r => server.close(r)); }
}

test('tela: login, origem, permissão do transmissor, expiração e encerramento', async () => setup(async (url,cookie) => {
  const unauth = await fetch(url+'/api/desktop/status');
  assert.equal(unauth.status,401);
  const badOrigin = await fetch(url+'/api/desktop/start',{method:'POST',headers:{Cookie:cookie,Origin:'https://other.test'}});
  assert.equal(badOrigin.status,403);
  const headers = {Cookie:cookie,Origin:url};
  const start = await fetch(url+'/api/desktop/start',{method:'POST',headers});
  assert.equal(start.status,200);
  const {token} = await start.json();
  assert.equal(token.length,64);
  const notAuthorized = await fetch(url+'/api/desktop/frame',{method:'POST',headers:{...headers, 'Content-Type':'image/jpeg','X-ShareCode-Stream-Token':'0'.repeat(64)},body:Buffer.from([0xff,0xd8,0xff,0xd9])});
  assert.equal(notAuthorized.status,403);
  const invalid = await fetch(url+'/api/desktop/frame',{method:'POST',headers:{...headers, 'Content-Type':'image/jpeg','X-ShareCode-Stream-Token':token},body:Buffer.from([1,2,3,4])});
  assert.equal(invalid.status,400);
  const jpg = Buffer.from([0xff,0xd8,0,1,0xff,0xd9]);
  const good = await fetch(url+'/api/desktop/frame',{method:'POST',headers:{...headers, 'Content-Type':'image/jpeg','X-ShareCode-Stream-Token':token},body:jpg});
  assert.equal(good.status,200);
  const image = await fetch(url+'/api/desktop/frame',{headers:{Cookie:cookie}});
  assert.equal(image.status,200);
  assert.equal(image.headers.get('content-type'),'image/jpeg');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),jpg);
  const stop = await fetch(url+'/api/desktop/stop',{method:'POST',headers:{...headers,'X-ShareCode-Stream-Token':token}});
  assert.equal(stop.status,200);
  assert.equal((await fetch(url+'/api/desktop/frame',{headers:{Cookie:cookie}})).status,404);
}));
