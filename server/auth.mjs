import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function createAuth(password, options = {}) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 512) {
    throw new Error('SHARECODE_PASSWORD precisa ter de 16 a 512 caracteres.');
  }
  const salt = randomBytes(32);
  const expected = scryptSync(password, salt, 64);
  const sessions = new Map();
  const attempts = new Map();
  const lifetime = options.lifetime ?? 12 * 60 * 60 * 1000;
  const now = options.now ?? Date.now;
  const cookieName = 'sharecode_session';

  function sweep() {
    const current = now();
    for (const [token, expiry] of sessions) if (expiry <= current) sessions.delete(token);
    for (const [ip, attempt] of attempts) if (attempt.until <= current && current - attempt.last > 15 * 60_000) attempts.delete(ip);
  }
  function checkPassword(candidate) {
    const comparable = typeof candidate === 'string' && candidate.length <= 512 ? candidate : '';
    const actual = scryptSync(comparable, salt, 64);
    return timingSafeEqual(expected, actual) && comparable.length >= 16;
  }
  function login(candidate, ip = 'unknown') {
    sweep();
    const entry = attempts.get(ip);
    if (entry?.until > now()) return { ok: false, locked: true };
    const valid = checkPassword(candidate);
    if (!valid) {
      const count = (entry?.count ?? 0) + 1;
      attempts.set(ip, { count, last: now(), until: count >= 5 ? now() + 15 * 60_000 : 0 });
      return { ok: false, locked: count >= 5 };
    }
    attempts.delete(ip);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, now() + lifetime);
    while (sessions.size > 10) sessions.delete(sessions.keys().next().value);
    return { ok: true, token };
  }
  function tokenFromCookie(raw = '') {
    const match = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`));
    const value = match?.slice(cookieName.length + 1) ?? '';
    return /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  function isAuthenticated(cookie) {
    sweep();
    const token = tokenFromCookie(cookie);
    return !!token && (sessions.get(token) ?? 0) > now();
  }
  function logout(cookie) {
    const token = tokenFromCookie(cookie);
    if (token) sessions.delete(token);
  }
  function cookie(token, secure = false) {
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(lifetime / 1000)}${secure ? '; Secure' : ''}`;
  }
  function clearCookie(secure = false) {
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
  }
  return { login, isAuthenticated, logout, cookie, clearCookie };
}
