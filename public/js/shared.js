/* ═══════════════════════════════════════════════
   shared.js — Utilitários compartilhados entre
   todas as páginas (api, showToast, mkEl)
   ═══════════════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname !== '/login.html' && window.location.pathname !== '/') {
    initRealtime();
    injectVictoryModal();
  }
});

/**
 * Wrapper de fetch com tratamento de 401
 */
async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  if (r.status === 401) {
    window.location.href = '/login.html';
    throw new Error('unauth');
  }
  return r;
}

/**
 * Exibe um toast de feedback
 * @param {string} msg  - Mensagem a exibir
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => (t.className = 'toast'), 2800);
}

function mkEl(tag, cls = '') {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

/**
 * Cria um esqueleto de carregamento
 */
function mkSkeleton(width = '100%', height = '20px', radius = '4px') {
  const s = mkEl('div', 'skeleton');
  s.style.width = width;
  s.style.height = height;
  s.style.borderRadius = radius;
  return s;
}

/** ── SISTEMA REAL-TIME (SSE) ── */
function initRealtime() {
  const source = new EventSource('/api/realtime/events');

  source.addEventListener('TOURNAMENT_CREATED', (e) => {
    const data = JSON.parse(e.data);
    showToast(`Novo Torneio: ${data.nome}`, 'info');
    if (typeof loadTorneios === 'function') loadTorneios();
    if (typeof loadAllTorneios === 'function') loadAllTorneios();
  });

  source.addEventListener('TOURNAMENT_UPDATED', () => {
    if (typeof loadTorneios === 'function') loadTorneios();
    if (typeof loadAllTorneios === 'function') loadAllTorneios();
  });

  source.addEventListener('MATCH_UPDATED', () => {
    if (typeof loadPartidas === 'function') loadPartidas();
    if (typeof carregarChaves === 'function') carregarChaves();
  });

  source.addEventListener('BALANCE_UPDATED', (e) => {
    const data = JSON.parse(e.data);
    const balanceEl = document.getElementById('user-saldo');
    if (balanceEl) balanceEl.innerText = `R$ ${data.novoSaldo.toFixed(2)}`;
    showToast('Saldo atualizado!', 'success');
    if (typeof loadHistorico === 'function') loadHistorico();
  });

  source.addEventListener('VICTORY', (e) => {
    const data = JSON.parse(e.data);
    showVictory(data.torneioNome);
  });

  source.addEventListener('WITHDRAWAL_UPDATED', () => {
    if (typeof loadUserSaques === 'function') loadUserSaques();
    if (typeof loadSaques === 'function') loadSaques();
  });

  source.onerror = () => {
    console.warn('Realtime: Conexão perdida. Tentando reconectar...');
  };
}

function injectVictoryModal() {
  const html = `
        <div id="victory-overlay" class="victory-overlay">
            <div class="victory-card">
                <div class="victory-icon">🏆</div>
                <div class="victory-title">PARABÉNS, CAMPEÃO!</div>
                <div id="victory-torneio-nome" class="victory-sub">Você venceu o torneio!</div>
                <p style="font-size:13px; color:var(--muted); margin-bottom:24px;">O prêmio foi creditado em sua conta.<br>Acesse sua carteira para confirmar.</p>
                <button class="btn-confirm" style="width:100%" onclick="hideVictory()">BRABO DEMAIS!</button>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML('beforeend', html);
}

function showVictory(nome) {
  document.getElementById('victory-torneio-nome').innerText = `Você venceu o torneio ${nome}!`;
  document.getElementById('victory-overlay').classList.add('show');
}

function hideVictory() {
  document.getElementById('victory-overlay').classList.remove('show');
}

/**
 * Custom Alert Profile / Estiloso
 */
function uiAlert(title, messageHtml) {
  return new Promise(resolve => {
    const overlay = mkEl('div', 'modal-overlay show');
    const box = mkEl('div', 'modal-box');
    box.style.maxWidth = '500px';

    box.innerHTML = `
      <div class="modal-title">${title}</div>
      <div style="color:var(--text);font-size:14px;margin-bottom:20px;line-height:1.6;max-height:60vh;overflow-y:auto;white-space:pre-wrap;">${messageHtml}</div>
      <div class="modal-btns">
        <button class="btn-confirm" id="ui-alert-ok">OK</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector('#ui-alert-ok').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
      resolve();
    };
  });
}

/**
 * Custom Confirm / Estiloso
 */
function uiConfirm(title, message) {
  return new Promise(resolve => {
    const overlay = mkEl('div', 'modal-overlay show');
    const box = mkEl('div', 'modal-box');
    box.style.maxWidth = '400px';

    box.innerHTML = `
      <div class="modal-title">${title}</div>
      <div style="color:var(--text);font-size:14px;margin-bottom:24px;line-height:1.6;">${message}</div>
      <div class="modal-btns">
        <button class="btn-cancel" id="ui-cf-cancel">Cancelar</button>
        <button class="btn-confirm" id="ui-cf-ok">Confirmar</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector('#ui-cf-cancel').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
      resolve(false);
    };

    box.querySelector('#ui-cf-ok').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
      resolve(true);
    };
  });
}

/**
 * Custom Prompt / Estiloso
 */
function uiPrompt(title, message, placeholder = '') {
  return new Promise(resolve => {
    const overlay = mkEl('div', 'modal-overlay show');
    const box = mkEl('div', 'modal-box');
    box.style.maxWidth = '400px';

    box.innerHTML = `
      <div class="modal-title">${title}</div>
      <div style="color:var(--text);font-size:14px;margin-bottom:12px;line-height:1.6;">${message}</div>
      <input type="text" id="ui-prompt-input" placeholder="${placeholder}" style="width:100%;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);color:var(--text);padding:12px;border-radius:8px;font-family:'Rajdhani',sans-serif;font-size:16px;margin-bottom:24px;" autocomplete="off">
      <div class="modal-btns">
        <button class="btn-cancel" id="ui-pt-cancel">Cancelar</button>
        <button class="btn-confirm" id="ui-pt-ok">Confirmar</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Focus automatically
    setTimeout(() => {
      const inp = box.querySelector('#ui-prompt-input');
      if (inp) inp.focus();
    }, 100);

    box.querySelector('#ui-pt-cancel').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
      resolve(null);
    };

    box.querySelector('#ui-pt-ok').onclick = () => {
      const val = box.querySelector('#ui-prompt-input').value;
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
      resolve(val);
    };
  });
}
