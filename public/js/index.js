/* ═══════════════════════════════════════════════
   index.js — Lógica da página principal:
   torneios, ranking, carteira, perfil
   ═══════════════════════════════════════════════ */

const GAMES = {
  coc: { name: 'Clash of Clans', emoji: '🏰' },
  cr: { name: 'Clash Royale', emoji: '⚔️' },
  brawl: { name: 'Brawl Stars', emoji: '🌟' },
  ff: { name: 'Free Fire', emoji: '🔥' },
  pubg: { name: 'PUBG Mobile', emoji: '🎯' },
  efootball: { name: 'eFootball', emoji: '⚽' },
  mc: { name: 'Mobile Legends', emoji: '🗡️' }
};

let torneiosCache = [];
let selectedGame = 'all';
let pixTorneioId = null;
let saldoVal = 10;
let pixKey = 'arena@amadora.com';
let currentUser = null;

/* ── INIT ── */
async function init() {
  try {
    const me = await (await api('/api/auth/me')).json();
    if (me.role === 'admin') { window.location.href = '/admin.html'; return; }
    currentUser = me;
    refreshUserUI(me);

    const cfg = await (await api('/api/config')).json();
    pixKey = cfg.pix_key || 'arena@amadora.com';
    document.getElementById('pix-saldo-key').textContent = pixKey;

    await loadTorneios();
  } catch (e) {
    if (e.message !== 'unauth') window.location.href = '/login.html';
  }
}

function refreshUserUI(u) {
  const s = (u.saldo || 0).toFixed(2).replace('.', ',');
  document.getElementById('saldo-display').textContent = s;
  document.getElementById('wallet-saldo').textContent = s;
  document.getElementById('user-name-display').textContent = u.name;
  document.getElementById('perfil-name').textContent = u.name;
  document.getElementById('perfil-phone').textContent = u.phone || '-';
  const elInscs = document.getElementById('perfil-inscricoes');
  if (elInscs) elInscs.textContent = u.inscricoes_count || '0';

  const elSaldo = document.getElementById('perfil-saldo-perfil');
  if (elSaldo) elSaldo.textContent = 'R$' + (u.saldo || 0).toFixed(0);

  if (document.getElementById('perfil-level')) {
    document.getElementById('perfil-level').textContent = u.level || 1;
    document.getElementById('perfil-xp').textContent = u.xp || 0;

    const lvl = u.level || 1;
    const xp = u.xp || 0;
    const baselineXP = Math.pow(lvl - 1, 2) * 100;
    const nextLevelXP = Math.pow(lvl, 2) * 100;
    const progress = Math.max(0, Math.min(100, ((xp - baselineXP) / (nextLevelXP - baselineXP)) * 100));

    setTimeout(() => {
      document.getElementById('perfil-xp-bar').style.width = progress + '%';
    }, 100);
  }
}

/* ── TORNEIOS ── */
async function loadTorneios() {
  const container = document.getElementById('tournaments-list');
  if (container) {
    container.innerHTML = Array(3).fill(0).map(() => `
      <div class="gaming-card" style="margin-bottom:16px; height: 180px; display:flex; flex-direction:column; gap:12px;">
        <div class="skeleton" style="width: 40%; height: 24px;"></div>
        <div class="skeleton" style="width: 100%; height: 16px;"></div>
        <div class="skeleton" style="width: 100%; height: 60px; margin-top: auto;"></div>
      </div>
    `).join('');
  }
  const r = await api('/api/torneios');
  torneiosCache = await r.json();
  renderGames();
  renderTorneios();
}

function renderGames() {
  const scroll = document.getElementById('games-scroll');
  const counts = {};
  torneiosCache.forEach(t => { counts[t.jogo] = (counts[t.jogo] || 0) + 1; });

  scroll.innerHTML = '';

  const allCard = mkEl('div', 'game-card' + (selectedGame === 'all' ? ' active' : ''));
  allCard.innerHTML = `<span class="game-emoji">🎮</span><div class="game-name">Todos</div><div class="game-count">${torneiosCache.length} torneios</div>`;
  allCard.addEventListener('click', () => { selectedGame = 'all'; renderGames(); renderTorneios(); });
  scroll.appendChild(allCard);

  Object.entries(GAMES).forEach(([id, g]) => {
    if (!counts[id]) return;
    const c = mkEl('div', 'game-card' + (selectedGame === id ? ' active' : ''));
    c.innerHTML = `<span class="game-emoji">${g.emoji}</span><div class="game-name">${g.name}</div><div class="game-count">${counts[id]} torneio${counts[id] > 1 ? 's' : ''}</div>`;
    c.addEventListener('click', () => { selectedGame = id; renderGames(); renderTorneios(); });
    scroll.appendChild(c);
  });
}

function renderTorneios() {
  const filtered = selectedGame === 'all' ? torneiosCache : torneiosCache.filter(t => t.jogo === selectedGame);
  const container = document.getElementById('tournaments-list');

  document.getElementById('torneios-count').textContent = filtered.length + ' disponíveis';

  const totalPremios = torneiosCache.reduce((s, t) => s + (t.premio || 0), 0);
  const totalInscs = torneiosCache.reduce((s, t) => s + (t.inscricoes_count || 0), 0);
  document.getElementById('stat-torneios').textContent = torneiosCache.length;
  document.getElementById('stat-jogadores').textContent = totalInscs;
  document.getElementById('stat-premios').textContent = 'R$' + totalPremios;

  if (!filtered.length) {
    container.innerHTML = '<div class="loading-placeholder">Nenhum torneio disponível para este jogo</div>';
    return;
  }

  container.innerHTML = filtered.map((t, i) => {
    const g = GAMES[t.jogo] || { emoji: '🎮', name: t.jogo };
    const inscs = t.inscricoes_count || 0;
    const vagas = t.vagas || 32;
    const pct = Math.min(100, Math.round((inscs / vagas) * 100));
    const enrolled = t.inscrito;
    const cheio = inscs >= vagas;
    const gratuito = !t.taxa || t.taxa === 0;

    let badgeClass = 'aberto', badgeText = '● Aberto';
    if (cheio) { badgeClass = 'cheio'; badgeText = '● Lotado'; }
    else if (t.status === 'breve') { badgeClass = 'breve'; badgeText = '⏳ Em breve'; }

    let btnClass = gratuito ? 'free-pill' : 'open';
    let btnText = gratuito ? '🎮 Inscrever Grátis' : `💳 Inscrever · R$${t.taxa}`;
    let btnAction = `handleInscrever('${t.id}', this)`;

    if (t.status === 'em_andamento' && enrolled) {
      btnClass = 'gold-pill';
      btnText = '⚔️ Minha Partida';
      btnAction = `openPlayerMatch('${t.id}', '${t.nome}')`;
    } else if (enrolled) {
      btnClass = 'enrolled'; btnText = '✅ Inscrito!'; btnAction = '';
    } else if (cheio || t.status === 'em_andamento' || t.status === 'finalizado') {
      btnClass = 'closed'; btnAction = '';
    }

    return `<div class="t-card" style="animation-delay:${i * .07}s">
      <div class="t-card-header">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:20px">${g.emoji}</span>
            <span class="t-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="t-title">${t.nome}</div>
          <div class="t-game-name">${g.name}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px;font-family:'Rajdhani',sans-serif;">Data</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);font-family:'Rajdhani',sans-serif;">${t.data_txt || 'A definir'}</div>
        </div>
      </div>
      <div class="t-card-body">
        <div class="t-info-grid">
          <div class="t-info"><div class="t-info-val gold">R$${t.premio || 0}</div><div class="t-info-lbl">Prêmio</div></div>
          <div class="t-info"><div class="t-info-val">${inscs}/${vagas}</div><div class="t-info-lbl">Vagas</div></div>
          <div class="t-info"><div class="t-info-val ${gratuito ? 'green' : ''}">${gratuito ? 'Grátis' : 'R$' + t.taxa}</div><div class="t-info-lbl">Inscrição</div></div>
        </div>
        <div class="t-progress"><div class="t-progress-bar" style="width:${pct}%"></div></div>
        <button class="btn-inscricao ${btnClass}" data-id="${t.id}" onclick="${btnAction}" ${(!btnAction && btnClass === 'closed') || (!btnAction && btnClass === 'enrolled') ? 'disabled' : ''}>
          ${btnText}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function handleInscrever(id, btn) {
  const t = torneiosCache.find(t => t.id === id);
  if (!t) return;
  if (!t.taxa || t.taxa === 0) return doInscrever(id, btn);

  pixTorneioId = id;
  document.getElementById('modal-torneio-nome').textContent = t.nome;
  document.getElementById('pix-key-display').textContent = pixKey;
  document.getElementById('pix-amount-display').textContent = 'R$ ' + t.taxa.toFixed(2);
  document.getElementById('modal-pix').classList.add('show');
}

async function doInscrever(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Inscrevendo...'; }
  try {
    const r = await api(`/api/torneios/${id}/inscrever`, { method: 'POST' });
    const d = await r.json();
    if (!r.ok) { showToast('⚠️ ' + (d.error || 'Erro'), 'error'); return; }
    showToast('✅ Inscrito com sucesso!', 'success');
    const me = await (await api('/api/auth/me')).json();
    currentUser = me;
    refreshUserUI(me);
    await loadTorneios();
  } catch (e) {
    showToast('Erro de conexão', 'error');
  } finally {
    if (btn && !btn.disabled) btn.disabled = false;
  }
}

/* ── RANKING ── */
async function loadRanking() {
  const r = await api('/api/users/ranking');
  const ranking = await r.json();
  const medals = ['🥇', '🥈', '🥉'];
  const posClass = ['gold', 'silver', 'bronze'];
  const avatars = ['🦁', '🐺', '🦊', '🐯', '🦅', '🐉', '🦈', '🐸'];

  document.getElementById('rank-list').innerHTML = ranking.map((r, i) => `
    <div class="rank-item" style="animation: fadeUp 0.5s var(--ease-out-expo) forwards; animation-delay: ${i * 0.05}s; opacity: 0;">
      <div class="rank-pos ${posClass[i] || 'other'}">${medals[i] || ('#' + (i + 1))}</div>
      <div class="rank-avatar">${avatars[i % 8]}</div>
      <div class="rank-name">${r.name}</div>
      <div class="rank-pts">${(r.inscricoes || 0) * 100} pts</div>
    </div>
  `).join('') || '<div class="loading-placeholder">Nenhum jogador ainda</div>';
}

/* ── HISTÓRICO ── */
async function loadHistorico() {
  const r = await api('/api/users/historico');
  const hist = await r.json();
  const container = document.getElementById('hist-list');

  if (!hist.length) {
    container.innerHTML = '<div class="loading-placeholder">Nenhuma transação ainda</div>';
    return;
  }

  container.innerHTML = hist.map((h, i) => `
    <div class="hist-item" style="animation: fadeUp 0.5s var(--ease-out-expo) forwards; animation-delay: ${i * 0.03}s; opacity: 0;">
      <div class="hist-icon">
        ${h.tipo === 'credito' ? '💸' : h.tipo === 'debit' ? '🎮' : '🔔'}
      </div>
      <div>
        <div class="hist-desc">${h.descricao}</div>
        <div class="hist-desc-sub">${new Date(h.created_at).toLocaleDateString('pt-BR')}</div>
      </div>
      <div class="hist-val ${h.tipo}">
        ${h.tipo === 'info' ? '' : (h.tipo === 'credito' ? '+' : '-') + 'R$' + Math.abs(h.valor).toFixed(2)}
      </div>
    </div>
  `).join('');
}

/* ── SAQUES DO USUÁRIO ── */
async function loadUserSaques() {
  const r = await api('/api/users/saques');
  const saques = await r.json();
  const container = document.getElementById('user-saques-container');
  const list = document.getElementById('user-saques-list');

  if (!saques.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  list.innerHTML = saques.map(s => {
    let statusLabel = 'Pendente';
    if (s.status === 'approved') statusLabel = 'Aprovado';
    if (s.status === 'rejected') statusLabel = 'Rejeitado';

    return `
      <div class="saque-status-card" style="display:block">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; font-weight:700">R$ ${s.amount.toFixed(2)}</div>
            <div style="font-size:10px; color:var(--muted)">${new Date(s.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
          <div class="status-badge ${s.status}">${statusLabel}</div>
        </div>
        ${s.admin_note ? `<div style="font-size:10px; color:var(--danger); margin-top:6px; border-top:1px solid rgba(255,255,255,0.05); padding-top:4px;">Nota: ${s.admin_note}</div>` : ''}
      </div>
    `;
  }).join('');
}

/* ── NAVEGAÇÃO ── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'ranking') loadRanking();
    if (page === 'carteira') { loadHistorico(); loadUserSaques(); refreshUserUI(currentUser || {}); }
    if (page === 'perfil' && currentUser) refreshUserUI(currentUser);
  });
});

/* ── MODAIS ── */
document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-pix').classList.remove('show');
  pixTorneioId = null;
});

document.getElementById('modal-confirm').addEventListener('click', async () => {
  if (!pixTorneioId) return;
  const btn = document.getElementById('modal-confirm');
  btn.disabled = true;
  btn.textContent = 'Processando...';
  document.getElementById('modal-pix').classList.remove('show');
  await doInscrever(pixTorneioId, null);
  pixTorneioId = null;
  btn.disabled = false;
  btn.textContent = '✅ Já Paguei!';
});

document.getElementById('btn-add-saldo').addEventListener('click', () =>
  document.getElementById('modal-saldo').classList.add('show')
);

document.getElementById('saldo-cancel').addEventListener('click', () =>
  document.getElementById('modal-saldo').classList.remove('show')
);

// ── SAQUE PIX (Player Dashboard) ──
document.getElementById('btn-saque-saldo').addEventListener('click', () => {
  document.getElementById('modal-saque-saldo-disponivel').textContent = 'R$ ' + (currentUser.saldo || 0).toFixed(2);
  document.getElementById('saque-valor').value = '';
  document.getElementById('saque-chave-pix').value = '';
  document.getElementById('modal-saque').classList.add('show');
});

document.getElementById('saque-cancel').addEventListener('click', () => {
  document.getElementById('modal-saque').classList.remove('show');
});

document.getElementById('saque-confirm').addEventListener('click', async () => {
  const amountVal = document.getElementById('saque-valor').value;
  const pixStr = document.getElementById('saque-chave-pix').value;

  if (!amountVal) return showToast('Preencha o valor do saque.', 'error');
  const amount = parseFloat(amountVal);

  if (isNaN(amount) || amount < 10) return showToast('Valor inválido. Mínimo R$ 10', 'error');
  if (amount > currentUser.saldo) return showToast('Saldo Insuficiente.', 'error');
  if (!pixStr || pixStr.trim().length < 5) return showToast('Chave PIX inválida.', 'error');

  const confirmMessage = `Você deseja sacar R$ ${amount.toFixed(2)} para a chave PIX: ${pixStr} ?`;
  document.getElementById('modal-saque').classList.remove('show'); // Hide form modal temporarily

  // We reuse the beautiful uiConfirm!
  if (!(await uiConfirm('Confirmar Saque', confirmMessage))) {
    // Se cancelou, pode reabrir o modal ou apenas não fazer nada.
    return;
  }

  try {
    const r = await api('/api/users/saque', {
      method: 'POST',
      body: JSON.stringify({ amount, pixKey: pixStr })
    });
    const d = await r.json();
    if (r.ok) {
      showToast('✅ Saque Solicitado! Retenções aplicadas.', 'success');
      const me = await (await api('/api/auth/me')).json();
      currentUser = me;
      refreshUserUI(me);
      loadHistorico();
    } else {
      showToast('Erro: ' + d.error, 'error');
    }
  } catch (e) {
    showToast('Erro de conexão ao solicitar saque', 'error');
  }
});

document.getElementById('btn-refresh-hist').addEventListener('click', () => {
  loadHistorico();
  loadUserSaques();
});

document.querySelectorAll('.saldo-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.saldo-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    saldoVal = parseInt(opt.dataset.val);
  });
});

document.getElementById('saldo-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('saldo-confirm');
  btn.disabled = true;
  btn.textContent = 'Processando...';
  try {
    const r = await api('/api/users/deposito', { method: 'POST', body: JSON.stringify({ valor: saldoVal }) });
    const d = await r.json();
    if (!r.ok) { showToast('⚠️ ' + (d.error || 'Erro'), 'error'); return; }
    document.getElementById('modal-saldo').classList.remove('show');
    showToast(`💰 R$${saldoVal},00 adicionados!`, 'success');
    const me = await (await api('/api/auth/me')).json();
    currentUser = me;
    refreshUserUI(me);
    loadHistorico();
  } catch (e) {
    showToast('Erro de conexão', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Confirmar';
  }
});

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

/* ── GERENCIAR PARTIDA (JOGADOR) ── */
async function openPlayerMatch(torneioId, torneioNome) {
  document.getElementById('p-match-torneio').textContent = torneioNome;
  document.getElementById('modal-match-player').classList.add('show');

  const actions = document.getElementById('p-match-actions');
  actions.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div> Carregando batalha...</div>';

  // Procura por todas as partidas do torneio e acha aquela que não finalizou e que o user está
  const r = await api('/api/matches/torneio/' + torneioId);
  const matches = await r.json();

  const minhamatch = matches.find(m =>
    (m.player1_id === currentUser.id || m.player2_id === currentUser.id) &&
    m.status !== 'finished'
  );

  if (!minhamatch) {
    document.getElementById('p-match-status').textContent = 'Eliminado / Aguardando';
    actions.innerHTML = '<div style="text-align:center;color:var(--muted)">Você não possui confrontos ativos no momento.</div>';
    return;
  }

  document.getElementById('p-match-round').textContent = 'Round ' + minhamatch.round + ' · Match ' + minhamatch.match_number;

  const souP1 = minhamatch.player1_id === currentUser.id;
  const oppNome = souP1 ? minhamatch.p2_name : minhamatch.p1_name;
  const oppId = souP1 ? minhamatch.player2_id : minhamatch.player1_id;

  document.getElementById('p-match-p1').textContent = 'Você';
  document.getElementById('p-match-p2').textContent = oppNome || 'Aguardando(Bye)';

  if (minhamatch.status === 'awaiting_result') {
    document.getElementById('p-match-status').textContent = 'Resultado em Análise Dupla';
    actions.innerHTML = '<div style="background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);padding:14px;border-radius:8px;font-size:12px;color:rgba(255,255,255,0.8);text-align:center;">' +
      'Alguém reportou o resultado desta partida. Se houver erro, inicie uma disputa.<br><br>' +
      '<button class="btn-admin danger sm" onclick="disputarPartida(\'' + minhamatch.id + '\')">⚠️ Abrir Disputa / Discordar</button>' +
      '</div>';
    return;
  }

  if (minhamatch.status === 'disputed') {
    document.getElementById('p-match-status').textContent = 'EM DISPUTA (Admin irá julgar)';
    actions.innerHTML = '<div style="text-align:center;color:var(--danger);font-size:12px">Aguardando decisão do administrador.</div>';
    return;
  }

  if (!oppId) {
    // Bye
    document.getElementById('p-match-status').textContent = 'Você passou de folga (Bye) ou o oponente desistiu.';
    actions.innerHTML = '';
    return;
  }

  document.getElementById('p-match-status').textContent = 'Em Andamento';

  // Interface de Envio
  actions.innerHTML = '<div style="font-size:13px;color:var(--muted);margin-bottom:8px">Quem Venceu?</div>' +
    '<select id="p-match-winner" style="width:100%;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,.1);color:var(--text);padding:10px;border-radius:8px;margin-bottom:12px">' +
    '<option value="">Selecione o vencedor...</option>' +
    '<option value="' + currentUser.id + '">🏆 Eu venci</option>' +
    '<option value="' + oppId + '">💀 Adversário (' + oppNome + ') venceu</option>' +
    '</select>' +
    '<div style="font-size:13px;color:var(--muted);margin-bottom:8px">Link da Prova (Print/Vídeo) <span style="font-size:10px">(Opcional para derrota)</span></div>' +
    '<input type="text" id="p-match-proof" placeholder="https://prnt.sc/..." style="width:100%;margin-bottom:16px" autocomplete="off" />' +
    '<button class="btn-primary" style="width:100%" onclick="enviarResultado(\'' + minhamatch.id + '\')">📡 Enviar Resultado</button>';
}
window.openPlayerMatch = openPlayerMatch;

async function enviarResultado(matchId) {
  const winnerId = document.getElementById('p-match-winner').value;
  const proofUrl = document.getElementById('p-match-proof').value.trim();
  if (!winnerId) return showToast('⚠️ Selecione o vencedor!', 'error');

  const r = await api('/api/matches/' + matchId + '/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ winnerId, proofUrl })
  });
  const d = await r.json();
  if (r.ok) {
    showToast('✅ ' + d.message, 'success');
    document.getElementById('modal-match-player').classList.remove('show');
  } else {
    showToast('Erro: ' + (d.error || 'Falha'), 'error');
  }
}
window.enviarResultado = enviarResultado;

async function disputarPartida(matchId) {
  if (!(await uiConfirm('Atenção: Disputa', 'Você tem certeza que discorda do resultado relatado pelo seu adversário? O Administrador será acionado para julgar o caso.'))) return;
  const r = await api('/api/matches/' + matchId + '/dispute', { method: 'POST' });
  const d = await r.json();
  if (r.ok) {
    showToast('✅ Disputa Aberta', 'success');
    document.getElementById('modal-match-player').classList.remove('show');
  } else {
    showToast('Erro ao abrir disputa', 'error');
  }
}
window.disputarPartida = disputarPartida;

init();

init();
