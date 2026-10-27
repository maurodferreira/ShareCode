import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../server/auth.mjs';

test('senha obrigatória e sessão válida', () => {
  assert.throws(() => createAuth('fraca'), /16/);
  const auth = createAuth('UmaSenhaFortissima!123');
  assert.equal(auth.login('errada').ok, false);
  const login = auth.login('UmaSenhaFortissima!123');
  assert.equal(login.ok, true);
  const cookie = auth.cookie(login.token, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.equal(auth.isAuthenticated(cookie), true);
  auth.logout(cookie);
  assert.equal(auth.isAuthenticated(cookie), false);
});

test('tentativas de autenticação bloqueadas', () => {
  const auth = createAuth('UmaSenhaFortissima!123');
  for (let i = 0; i < 4; i++) assert.equal(auth.login('errada', 'ip').locked, false);
  assert.equal(auth.login('errada', 'ip').locked, true);
  assert.equal(auth.login('UmaSenhaFortissima!123', 'ip').ok, false);
});
