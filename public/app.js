const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { authenticated: false, engine: false, sessions: [], selected: null, drafts: [], view: 'overview', fileName: null, refreshing: false };
const displayNames = { overview: 'Visão geral', sessions: 'Sessões OpenCode', flight: 'Modo Voo', security: 'Segurança' };
let toastTimer;
const dateLabel = (value) => { try { return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; } };
function toast(message) { const element = $('#toast'); element.textContent = message; element.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.style.display = 'none'; }, 4000); }
function setText(selector, text) { $(selector).textContent = text; }
function setStatus() {
  const online = navigator.onLine;
  $('#network-status').textContent = online ? (state.engine ? '● Conectado' : '● Rede online') : '○ Offline';
  $('#network-status').classList.toggle('connected', online && state.engine);
  $('#sidebar-dot').classList.toggle('on', online && state.engine);
  setText('#sidebar-status', online && state.engine ? 'OpenCode conectado' : (online ? 'OpenCode indisponível' : 'Modo offline'));
  setText('#stat-connection', !online ? 'Offline' : state.engine ? 'Online' : 'Sem serviço');
  setText('#flight-network', online ? 'Rede disponível' : 'Modo offline');
}
function showView(view) {
  state.view = view;
  $$('[data-screen]').forEach((el) => { el.hidden = el.dataset.screen !== view; });
  $$('[data-view]').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  setText('#breadcrumb', displayNames[view]);
  if (view === 'sessions' && state.authenticated && navigator.onLine) loadSessions();
  if (view === 'flight') renderDrafts();
}
function unwrap(data) { return data?.data ?? data; }
function asArray(data) {
  const value = unwrap(data);
  if (Array.isArray(value)) return value;
  return value?.items ?? value?.sessions ?? value?.messages ?? [];
}
async function api(endpoint, options = {}) {
  let response;
  try {
    response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', ...options, headers: options.body ? { 'Content-Type': 'application/json' } : undefined });
  } catch { throw new Error('Sem conexão com seu computador. Os rascunhos offline continuam disponíveis.'); }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && endpoint !== '/api/auth/login') { state.authenticated = false; state.engine = false; showGate(); }
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data.result ?? data;
}
function showGate() {
  // Offline: permitir abrir o caderno já armazenado no dispositivo, sem expor sessões remotas.
  const offline = !navigator.onLine;
  $('#login').hidden = offline;
  $('#application').hidden = !offline;
  if (offline) showView('flight');
}
async function startup() {
  try {
    const status = await api('/api/auth/status');
    state.authenticated = !!status.authenticated;
  } catch { state.authenticated = false; }
  $('#login').hidden = state.authenticated;
  $('#application').hidden = !state.authenticated;
  if (!state.authenticated) showGate();
  await renderDrafts();
  if (state.authenticated) await refreshAll();
  setStatus();
}
async function refreshAll() {
  if (!state.authenticated || !navigator.onLine) { state.engine = false; setStatus(); return; }
  try {
    const info = await api('/api/system/status');
    state.engine = true;
    setText('#engine-description', `Servidor disponível${info?.version ? ` • versão ${info.version}` : ''}. As sessões continuam no seu PC.`);
    await loadSessions();
  } catch (error) {
    state.engine = false;
    setText('#engine-description', error.message);
    setText('#stat-sessions', '—');
    setText('#session-error', error.message);
  }
  setStatus();
}
function renderSessions() {
  setText('#stat-sessions', String(state.sessions.length));
  setText('#sessions-counter', String(state.sessions.length));
  const list = $('#session-list'); list.replaceChildren();
  if (!state.sessions.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Nenhuma sessão encontrada. Crie uma nova sessão.'; list.append(empty); return; }
  for (const session of state.sessions) {
    const item = document.createElement('button'); item.type = 'button';
    item.className = `session-item${session.id === state.selected ? ' active' : ''}`;
    const name = document.createElement('strong'); name.textContent = session.title || `Sessão ${session.id?.slice(0, 8)}`;
    const sub = document.createElement('small'); sub.textContent = session.time?.updated ? dateLabel(session.time.updated) : session.id;
    item.append(name, sub); item.addEventListener('click', () => selectSession(session.id)); list.append(item);
  }
}
async function loadSessions() {
  if (!state.authenticated || state.refreshing || !navigator.onLine) return;
  state.refreshing = true;
  try {
    const raw = await api('/api/sessions');
    state.sessions = asArray(raw);
    setText('#session-error', '');
    if (state.selected && !state.sessions.some((s) => s.id === state.selected)) state.selected = null;
    renderSessions();
    if (state.selected) await loadMessages();
  } catch (error) { setText('#session-error', error.message); }
  finally { state.refreshing = false; }
}
async function selectSession(id) {
  state.selected = id;
  const active = state.sessions.find((s) => s.id === id);
  setText('#current-session-title', active?.title || 'Sessão');
  setText('#current-session-id', id);
  renderSessions();
  await loadMessages();
}
function messageText(entry) {
  if (typeof entry?.text === 'string') return entry.text;
  const parts = entry?.parts ?? entry?.content ?? [];
  if (typeof parts === 'string') return parts;
  if (Array.isArray(parts)) return parts.filter((p) => p.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('\n');
  return '';
}
async function loadMessages() {
  if (!state.selected || !navigator.onLine) return;
  const selected = state.selected;
  try {
    const data = asArray(await api(`/api/sessions/${encodeURIComponent(selected)}/messages`));
    if (state.selected !== selected) return;
    const list = $('#message-list'); list.replaceChildren();
    const meaningful = data.filter((entry) => messageText(entry));
    if (!meaningful.length) { const el = document.createElement('div'); el.className = 'empty'; el.textContent = 'Sem mensagens textuais nesta sessão.'; list.append(el); return; }
    meaningful.forEach((entry) => {
      const type = entry.info?.type || entry.type || entry.role || 'assistant';
      const msg = document.createElement('div'); msg.className = `message ${type === 'user' ? 'user' : 'assistant'}`;
      const who = document.createElement('small'); who.textContent = type === 'user' ? 'VOCÊ' : 'OPENCODE';
      const content = document.createElement('p'); content.textContent = messageText(entry).slice(0, 14000);
      msg.append(who, content); list.append(msg);
    });
    list.scrollTop = list.scrollHeight;
  } catch (error) { toast(error.message); }
}
function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível neste navegador.'));
    const request = indexedDB.open('sharecode-offline', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function dbRun(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', mode);
    const store = tx.objectStore('drafts');
    let request;
    try { request = action(store); } catch (error) { reject(error); db.close(); return; }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { reject(tx.error); db.close(); };
  });
}
async function saveDraft(text, sessionId = state.selected) {
  if (!text.trim()) { toast('Digite um rascunho antes de salvar.'); return; }
  await dbRun('readwrite', (s) => s.put({ id: crypto.randomUUID(), text: text.trim(), sessionId: sessionId || null, createdAt: new Date().toISOString() }));
  toast('Rascunho salvo no dispositivo.'); await renderDrafts();
}
async function deleteDraft(id) { await dbRun('readwrite', (s) => s.delete(id)); await renderDrafts(); }
async function renderDrafts() {
  try { state.drafts = (await dbRun('readonly', (s) => s.getAll())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  catch (error) { toast(`Armazenamento offline: ${error.message}`); return; }
  setText('#stat-drafts', String(state.drafts.length));
  setText('#draft-count', String(state.drafts.length));
  const list = $('#draft-list'); list.replaceChildren();
  if (!state.drafts.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'Nenhum rascunho. Anote uma tarefa para a próxima conexão.'; list.append(empty); return; }
  for (const draft of state.drafts) {
    const item = document.createElement('div'); item.className = 'draft';
    const date = document.createElement('small'); date.textContent = dateLabel(draft.createdAt);
    const content = document.createElement('p'); content.textContent = draft.text;
    const actions = document.createElement('div'); actions.className = 'draft-actions';
    const edit = document.createElement('button'); edit.textContent = 'Copiar para mensagem';
    edit.onclick = () => { $('#prompt').value = draft.text; if (draft.sessionId && state.sessions.some((s) => s.id === draft.sessionId)) { selectSession(draft.sessionId); } showView('sessions'); toast('Revise e confirme o envio manualmente.'); };
    const remove = document.createElement('button'); remove.textContent = 'Excluir'; remove.onclick = () => { if (confirm('Excluir este rascunho somente deste dispositivo?')) deleteDraft(draft.id); };
    actions.append(edit, remove); item.append(date, content, actions); list.append(item);
  }
}
function downloadFile(name, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$$('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
$$('[data-goto]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.goto)));
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); setText('#login-error', '');
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) });
    $('#password').value = ''; state.authenticated = true;
    $('#login').hidden = true; $('#application').hidden = false; showView('overview'); await refreshAll();
  } catch (error) { setText('#login-error', error.message); }
});
$('#logout').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {} state.authenticated = false; state.engine = false; showGate(); });
$('#refresh-sessions').addEventListener('click', () => refreshAll());
$('#new-session-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = unwrap(await api('/api/sessions', { method: 'POST', body: JSON.stringify({ title: $('#new-session-title').value }) }));
    $('#new-session-title').value = ''; await loadSessions();
    if (response?.id) await selectSession(response.id);
    toast('Sessão criada.');
  } catch (error) { toast(error.message); }
});
$('#prompt-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = $('#prompt').value.trim(); if (!text) return;
  if (!state.selected || !navigator.onLine) { toast('Sem sessão/conexão. Use Guardar offline.'); return; }
  $('#send-prompt').disabled = true;
  try {
    await api(`/api/sessions/${encodeURIComponent(state.selected)}/prompt`, { method: 'POST', body: JSON.stringify({ text }) });
    $('#prompt').value = ''; toast('Mensagem recebida pelo OpenCode.'); await loadMessages();
  } catch (error) { toast(error.message); }
  finally { $('#send-prompt').disabled = false; }
});
$('#save-prompt').addEventListener('click', async () => { try { await saveDraft($('#prompt').value); $('#prompt').value = ''; } catch (e) { toast(e.message); } });
$('#add-draft').addEventListener('click', async () => { try { await saveDraft($('#draft-text').value); $('#draft-text').value = ''; } catch (e) { toast(e.message); } });
$('#export-drafts').addEventListener('click', () => downloadFile('sharecode-rascunhos.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), drafts: state.drafts }, null, 2), 'application/json'));
$('#file-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  if (file.size > 500_000) { toast('Máximo de 500 KB por arquivo.'); event.target.value = ''; return; }
  try { $('#file-editor').value = await file.text(); state.fileName = file.name; setText('#editor-filename', file.name); toast('Arquivo importado. Exporte depois de editar.'); }
  catch { toast('Não foi possível ler o arquivo.'); }
});
$('#download-file').addEventListener('click', () => { if (!state.fileName) return toast('Importe um arquivo primeiro.'); downloadFile(state.fileName, $('#file-editor').value); toast('Arquivo exportado. Confira o download.'); });
window.addEventListener('online', () => { setStatus(); if (state.authenticated) refreshAll(); else startup(); });
window.addEventListener('offline', () => { state.engine = false; setStatus(); if (!state.authenticated) showGate(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.authenticated && navigator.onLine) refreshAll(); });
setInterval(() => { if (!document.hidden && state.authenticated && navigator.onLine && state.selected) loadMessages(); }, 9000);
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
startup();
