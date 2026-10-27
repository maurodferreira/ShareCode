// Visualização voluntária: captura somente após permissão do navegador do PC.
// Não existe controle de teclado/mouse, gravação ou captura automática.
export function initDesktop({ api, toast }) {
  const byId = (id) => document.getElementById(id);
  const preview = byId('desktop-preview');
  const placeholder = byId('desktop-placeholder');
  const status = byId('desktop-status');
  const start = byId('desktop-start');
  const stop = byId('desktop-stop');
  const refresh = byId('desktop-refresh');
  let stream = null;
  let token = null;
  let timer = null;
  let viewerTimer = null;
  let objectUrl = null;
  let sending = false;
  let watching = false;

  function message(value) { status.textContent = value; }
  function removePreview() {
    preview.hidden = true;
    preview.removeAttribute('src');
    placeholder.hidden = false;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  async function showLatest() {
    if (!watching || document.hidden || !navigator.onLine) return;
    try {
      const response = await fetch('/api/desktop/frame', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 404) { removePreview(); message('Aguardando compartilhamento no computador'); return; }
      if (!response.ok) throw new Error('Imagem indisponível');
      const url = URL.createObjectURL(await response.blob());
      const old = objectUrl;
      objectUrl = url;
      preview.src = url;
      preview.hidden = false;
      placeholder.hidden = true;
      if (old) URL.revokeObjectURL(old);
      message('Tela ao vivo • somente visualização');
    } catch { removePreview(); message('Sem acesso à transmissão'); }
  }
  async function sendFrame(video, canvas) {
    if (!stream || sending || !token || video.readyState < 2) return;
    sending = true;
    try {
      const width = Math.min(1024, video.videoWidth || 1024);
      const height = Math.max(1, Math.round(width * (video.videoHeight || 9) / (video.videoWidth || 16)));
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(video, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.55));
      if (!blob || blob.size > 220000) throw new Error('Quadro muito grande para enviar');
      const response = await fetch('/api/desktop/frame', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'image/jpeg', 'X-ShareCode-Stream-Token': token }, body: blob
      });
      if (!response.ok) throw new Error('Falha no envio da tela');
      message('Transmitindo • encerre a qualquer momento');
    } catch (error) { toast(error.message); await stopSharing(); }
    finally { sending = false; }
  }
  async function stopSharing() {
    clearInterval(timer); timer = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    if (token) {
      const lastToken = token; token = null;
      await fetch('/api/desktop/stop', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'X-ShareCode-Stream-Token': lastToken } }).catch(() => {});
    }
    start.hidden = false;
    stop.hidden = true;
    message('Compartilhamento encerrado');
  }
  start.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return toast('Compartilhe a tela pelo Chrome ou Edge do computador.');
    let capture;
    try {
      capture = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
      const response = await api('/api/desktop/start', { method: 'POST', body: '{}' });
      stream = capture;
      token = response.token;
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      stream.getVideoTracks()[0].addEventListener('ended', () => { stopSharing(); }, { once: true });
      start.hidden = true;
      stop.hidden = false;
      message('Transmitindo • encerre a qualquer momento');
      await sendFrame(video, canvas);
      timer = setInterval(() => { sendFrame(video, canvas); }, 1600);
    } catch (error) {
      if (capture) capture.getTracks().forEach((track) => track.stop());
      await stopSharing();
      if (error.name !== 'NotAllowedError') toast(`Não foi possível compartilhar: ${error.message}`);
    }
  });
  stop.addEventListener('click', stopSharing);
  refresh.addEventListener('click', showLatest);
  return {
    onView(view) {
      watching = view === 'desktop';
      clearInterval(viewerTimer);
      viewerTimer = null;
      if (watching) {
        showLatest();
        viewerTimer = setInterval(showLatest, 2300);
      } else removePreview();
    }
  };
}
