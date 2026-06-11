let overlayState = null;
let processingDepth = 0;
let scrollLockState = null;

function ensureStyles() {
  if (document.getElementById('nh-global-processing-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-global-processing-style';
  style.textContent = `
    .nh-global-processing{
      position:fixed;
      inset:0;
      z-index:2147483000;
      display:grid;
      place-items:center;
      padding:24px;
      background:rgba(7,14,28,.38);
      backdrop-filter:blur(10px);
      pointer-events:auto;
      isolation:isolate;
    }
    .nh-global-processing[hidden]{display:none}
    .nh-global-processing__card{
      width:min(560px,100%);
      border:1px solid rgba(219,228,242,.9);
      border-radius:24px;
      background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(246,249,255,.98));
      box-shadow:0 30px 80px rgba(14,30,64,.24);
      padding:22px;
      color:#12203a;
    }
    .nh-global-processing__title{
      margin:0;
      font-size:20px;
      font-weight:800;
      letter-spacing:-.02em;
    }
    .nh-global-processing__message{
      margin:10px 0 0;
      color:#61708f;
      line-height:1.5;
    }
    .nh-global-processing__bar{
      margin-top:18px;
      height:12px;
      border-radius:999px;
      background:#e7edf8;
      overflow:hidden;
      position:relative;
    }
    .nh-global-processing__bar > span{
      display:block;
      height:100%;
      border-radius:inherit;
      background:linear-gradient(90deg,#1f56dc,#4f7ef8);
      transition:width .22s ease;
      width:var(--progress,35%);
    }
    .nh-global-processing--indeterminate .nh-global-processing__bar > span{
      width:38%;
      animation:nh-global-processing-indeterminate 1.15s ease-in-out infinite;
      transform-origin:left center;
    }
    .nh-global-processing__meta{
      display:flex;
      justify-content:space-between;
      gap:12px;
      margin-top:10px;
      color:#6b7a96;
      font-size:12px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:.06em;
    }
    @keyframes nh-global-processing-indeterminate{
      0%{transform:translateX(-25%)}
      50%{transform:translateX(110%)}
      100%{transform:translateX(250%)}
    }
  `;
  document.head.appendChild(style);
}

function ensureOverlay() {
  ensureStyles();
  if (overlayState?.el?.isConnected) return overlayState;
  const el = document.createElement('div');
  el.className = 'nh-global-processing';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-modal', 'true');
  el.tabIndex = -1;
  el.hidden = true;
  el.innerHTML = `
    <div class="nh-global-processing__card">
      <h2 class="nh-global-processing__title"></h2>
      <p class="nh-global-processing__message"></p>
      <div class="nh-global-processing__bar"><span></span></div>
      <div class="nh-global-processing__meta"><span class="nh-global-processing__status"></span><span class="nh-global-processing__percent"></span></div>
    </div>
  `;
  document.body.appendChild(el);
  overlayState = {
    el,
    titleEl: el.querySelector('.nh-global-processing__title'),
    messageEl: el.querySelector('.nh-global-processing__message'),
    barEl: el.querySelector('.nh-global-processing__bar'),
    statusEl: el.querySelector('.nh-global-processing__status'),
    percentEl: el.querySelector('.nh-global-processing__percent'),
    previousOverflow: '',
    previousHtmlOverflow: '',
    previousBodyPointerEvents: '',
    previousHtmlPointerEvents: '',
    previousBodyOverflow: '',
    previousHtmlOverflowStyle: '',
    previousBodyOverflowX: '',
    previousBodyOverflowY: ''
  };
  return overlayState;
}

function lockScroll(overlay) {
  if (scrollLockState) {
    processingDepth += 1;
    return;
  }
  processingDepth = 1;
  scrollLockState = {
    bodyOverflow: document.body?.style.overflow || '',
    bodyOverflowX: document.body?.style.overflowX || '',
    bodyOverflowY: document.body?.style.overflowY || '',
    bodyPointerEvents: document.body?.style.pointerEvents || '',
    htmlOverflow: document.documentElement?.style.overflow || '',
    htmlPointerEvents: document.documentElement?.style.pointerEvents || ''
  };
  if (document.body) {
    document.body.style.overflow = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'hidden';
    document.body.style.pointerEvents = 'none';
  }
  if (document.documentElement) {
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.pointerEvents = 'none';
  }
  overlay.el.style.pointerEvents = 'auto';
}

function unlockScroll() {
  if (!scrollLockState) return;
  processingDepth = Math.max(0, processingDepth - 1);
  if (processingDepth > 0) return;
  const state = scrollLockState;
  scrollLockState = null;
  if (document.body) {
    document.body.style.overflow = state.bodyOverflow;
    document.body.style.overflowX = state.bodyOverflowX;
    document.body.style.overflowY = state.bodyOverflowY;
    document.body.style.pointerEvents = state.bodyPointerEvents;
  }
  if (document.documentElement) {
    document.documentElement.style.overflow = state.htmlOverflow;
    document.documentElement.style.pointerEvents = state.htmlPointerEvents;
  }
}

function destroyOverlay() {
  const overlay = overlayState;
  if (!overlay?.el) return;
  overlay.el.hidden = true;
  overlay.el.removeAttribute('aria-busy');
  overlay.el.classList.remove('nh-global-processing--indeterminate');
  overlay.el.replaceChildren();
  overlay.el.remove();
  overlayState = null;
}

export function showGlobalProcessing({ title = 'Processando...', message = '', progress = 0, indeterminate = true } = {}) {
  const overlay = ensureOverlay();
  overlay.titleEl.textContent = title;
  overlay.messageEl.textContent = message;
  overlay.statusEl.textContent = indeterminate ? 'Aguardando conclusão' : 'Em andamento';
  overlay.percentEl.textContent = indeterminate ? '' : `${Math.max(0, Math.min(100, Number(progress) || 0))}%`;
  overlay.barEl.style.setProperty('--progress', `${Math.max(0, Math.min(100, Number(progress) || 0))}%`);
  overlay.el.classList.toggle('nh-global-processing--indeterminate', Boolean(indeterminate));
  overlay.el.hidden = false;
  overlay.el.setAttribute('aria-busy', 'true');
  lockScroll(overlay);
  overlay.el.focus({ preventScroll: true });
}

export function updateGlobalProcessing({ title, message, progress, indeterminate } = {}) {
  const overlay = overlayState?.el?.isConnected ? overlayState : null;
  if (!overlay) return;
  if (title !== undefined) overlay.titleEl.textContent = title;
  if (message !== undefined) overlay.messageEl.textContent = message;
  if (indeterminate !== undefined) {
    overlay.el.classList.toggle('nh-global-processing--indeterminate', Boolean(indeterminate));
    overlay.statusEl.textContent = indeterminate ? 'Aguardando conclusão' : 'Em andamento';
  }
  if (progress !== undefined) {
    const value = Math.max(0, Math.min(100, Number(progress) || 0));
    overlay.barEl.style.setProperty('--progress', `${value}%`);
    overlay.percentEl.textContent = `${value}%`;
  }
}

export function hideGlobalProcessing() {
  const overlay = overlayState?.el?.isConnected ? overlayState : null;
  unlockScroll();
  if (!overlay) {
    destroyOverlay();
    return;
  }
  if (processingDepth > 0) {
    return;
  }
  overlay.el.hidden = true;
  overlay.el.removeAttribute('aria-busy');
  overlay.el.classList.remove('nh-global-processing--indeterminate');
  overlay.el.replaceChildren();
  destroyOverlay();
}

export async function withGlobalProcessing(task, options = {}) {
  showGlobalProcessing(options);
  try {
    return await task();
  } finally {
    hideGlobalProcessing();
  }
}
