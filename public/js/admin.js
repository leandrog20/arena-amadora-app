/* ═══════════════════════════════════════════════
   admin.js — Lógica do painel administrativo
   ═══════════════════════════════════════════════ */

const GAME_NAMES = {
  coc: 'Clash of Clans', cr: 'Clash Royale', brawl: 'Brawl Stars',
  ff: 'Free Fire', pubg: 'PUBG Mobile', efootball: 'eFootball', mc: 'Mobile Legends'
};

const GAME_EMOJIS = {
  coc: '🏰', cr: '⚔️', brawl: '🌟', ff: '🔥', pubg: '🎯', efootball: '⚽', mc: '🗡️'
};

const ADMIN_LUCRO_PCT = 0.10;
let auditPage = 1;
const auditLimit = 10;

/* ── API OVERRIDE (admin tem 403 extra) ── */
async function apiAdmin(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (r.status === 401) { window.location.href = '/login.html'; throw new Error('unauth'); }
  if (r.status === 403) { showToast('⚠️ Acesso negado', 'error'); throw new Error('forbidden'); }
  return r;
}

function parseMoneyInput(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function formatMoneyBR(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function updatePricingPreview() {
  const premio = parseMoneyInput(document.getElementById('t-premio').value);
  const vagasRaw = parseInt(document.getElementById('t-vagas').value, 10);
  const vagas = Number.isFinite(vagasRaw) && vagasRaw > 0 ? vagasRaw : 1;

  const lucroAdmin = premio * ADMIN_LUCRO_PCT;
  const arrecadacaoTotal = premio + lucroAdmin;
  const taxaPorJogador = arrecadacaoTotal / vagas;

  document.getElementById('calc-premio').textContent = formatMoneyBR(premio);
  document.getElementById('calc-lucro').textContent = formatMoneyBR(lucroAdmin);
  document.getElementById('calc-total').textContent = formatMoneyBR(arrecadacaoTotal);
  document.getElementById('calc-inscricao').textContent = formatMoneyBR(taxaPorJogador);

  document.getElementById('t-taxa').value = taxaPorJogador.toFixed(2);
}

document.getElementById('t-premio').addEventListener('input', updatePricingPreview);
document.getElementById('t-vagas').addEventListener('input', updatePricingPreview);

/* ── INIT ── */
async function init() {
  try {
    const me = await (await fetch('/api/auth/me')).json();
    if (!me || me.role !== 'admin') { window.location.href = '/login.html'; return; }
    await loadDashboard();
    await loadConfig();
  } catch (e) {
    if (e.message !== 'unauth') window.location.href = '/login.html';
  }
}

/* ── DASHBOARD ── */
async function loadDashboard() {
  const [statsR, torneiosR] = await Promise.all([
    apiAdmin('/api/config/stats'),
    apiAdmin('/api/torneios')
  ]);
  const stats   = await statsR.json();
  const torneios = await torneiosR.json();
  const arrecadacaoTotalPrevista = torneios.reduce((acc, t) => {
    const vagas = t.vagas || 0;
    const taxa = t.taxa || 0;
    return acc + (taxa * vagas);
  }, 0);
  const lucroEstimadoTotal = torneios.reduce((acc, t) => {
    const vagas = t.vagas || 0;
    const taxa = t.taxa || 0;
    const premio = t.premio || 0;
    return acc + ((taxa * vagas) - premio);
  }, 0);
  const margemMedia = arrecadacaoTotalPrevista > 0
    ? (lucroEstimadoTotal / arrecadacaoTotalPrevista) * 100
    : 0;
  const lucroEl = document.getElementById('stat-lucro-estimado');
  const lucroClass = lucroEstimadoTotal > 0 ? 'positive' : (lucroEstimadoTotal < 0 ? 'negative' : 'neutral');
  const margemEl = document.getElementById('stat-margem-media');
  const margemClass = margemMedia > 0 ? 'positive' : (margemMedia < 0 ? 'negative' : 'neutral');

  document.getElementById('stat-torneios').textContent  = stats.torneios;
  document.getElementById('stat-users').textContent     = stats.usuarios;
  document.getElementById('stat-receita').textContent   = 'R$' + (stats.receita || 0).toFixed(0);
  document.getElementById('stat-inscricoes').textContent = stats.inscricoes;
  lucroEl.className = `stats-profit-value ${lucroClass}`;
  lucroEl.textContent = formatMoneyBR(lucroEstimadoTotal);
  margemEl.className = `stats-profit-meta ${margemClass}`;
  margemEl.textContent = `Margem média: ${margemMedia.toFixed(1).replace('.', ',')}%`;

  const tbody  = document.getElementById('dash-torneios-body');
  const recent = torneios.slice(0, 6);

  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">Nenhum torneio ainda</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(t => `
    <tr>
      <td>
        <div class="t-row-name">${GAME_EMOJIS[t.jogo] || '🎮'} ${t.nome}</div>
        <div class="t-row-sub">${GAME_NAMES[t.jogo] || t.jogo} · ${t.data_txt || 'Sem data'}</div>
      </td>
      <td style="font-family:'Rajdhani',sans-serif;font-weight:700;">${t.inscricoes_count || 0}/${t.vagas}</td>
      <td style="color:var(--gold);font-family:'Orbitron',sans-serif;font-size:12px">R$${t.premio || 0}</td>
      <td><span class="mini-badge ${(t.inscricoes_count || 0) >= (t.vagas || 32) ? 'encerrado' : 'aberto'}">${(t.inscricoes_count || 0) >= (t.vagas || 32) ? 'Lotado' : 'Aberto'}</span></td>
    </tr>
  `).join('');
}

/* ── CRIAR TORNEIO ── */
document.getElementById('btn-criar-torneio').addEventListener('click', async () => {
  const nome    = document.getElementById('t-nome').value.trim();
  const jogo    = document.getElementById('t-jogo').value;
  const dataRaw = document.getElementById('t-data').value;
  const vagas   = parseInt(document.getElementById('t-vagas').value) || 32;
  const taxa    = parseFloat(document.getElementById('t-taxa').value) || 0;
  const premio  = parseFloat(document.getElementById('t-premio').value) || 0;
  const formato = document.getElementById('t-formato').value;
  const regras  = document.getElementById('t-regras').value.trim();
  const data_txt = dataRaw ? new Date(dataRaw + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir';

  if (!nome) return showToast('⚠️ Informe o nome do torneio', 'error');

  const btn = document.getElementById('btn-criar-torneio');
  btn.disabled = true;
  btn.textContent = 'Criando...';

  try {
    const r = await apiAdmin('/api/torneios', {
      method: 'POST',
      body: JSON.stringify({ nome, jogo, data_txt, vagas, taxa, premio, formato, regras })
    });
    const d = await r.json();
    if (!r.ok) return showToast('⚠️ ' + (d.error || 'Erro'), 'error');
    showToast('✅ Torneio criado!', 'success');
    ['t-nome', 't-regras'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('t-premio').value = '50';
    document.getElementById('t-vagas').value  = '32';
    updatePricingPreview();
    await loadDashboard();
  } catch (e) {
    if (e.message !== 'unauth') showToast('Erro de conexão', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Criar Torneio';
  }
});

/* ── TODOS OS TORNEIOS ── */
async function loadAllTorneios() {
  const r        = await apiAdmin('/api/torneios');
  const torneios = await r.json();
  const container = document.getElementById('all-torneios-list');

  document.getElementById('all-t-count').textContent = torneios.length + ' torneios';

  if (!torneios.length) {
    container.innerHTML = '<div class="loading-placeholder">Nenhum torneio ainda. Crie um!</div>';
    return;
  }

  container.innerHTML = torneios.map((t, i) => {
    const inscs = t.inscricoes_count || 0;
    const pct   = Math.min(100, Math.round((inscs / (t.vagas || 32)) * 100));
    const vagas = t.vagas || 0;
    const taxa = t.taxa || 0;
    const premio = t.premio || 0;
    const arrecadacaoPrevista = taxa * vagas;
    const lucroEstimado = arrecadacaoPrevista - premio;
    const isEmAndamento = t.status === 'em_andamento';
    const isFinalizado  = t.status === 'finalizado';
    let statusLabel = 'Aberto';
    let statusClass = 'aberto';
    if (t.status === 'aberto' && inscs >= (t.vagas || 32)) { statusLabel = 'Lotado'; statusClass = 'encerrado'; }
    if (isEmAndamento) { statusLabel = 'Em Andamento'; statusClass = 'breve'; }
    if (isFinalizado)  { statusLabel = 'Finalizado';   statusClass = 'encerrado'; }

    return `
      <div style="background:rgba(16,18,26,.85);border:1px solid var(--border);border-radius:18px;padding:18px;margin-bottom:12px;backdrop-filter:blur(12px);transition:border-color .25s; animation: fadeUp 0.5s var(--ease-out-expo) forwards; animation-delay: ${i * 0.05}s; opacity: 0;" onmouseover="this.style.borderColor='rgba(255,215,0,.28)'" onmouseout="this.style.borderColor='rgba(255,215,0,.12)'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:13px;color:var(--muted);font-family:'Inter',sans-serif;">${GAME_EMOJIS[t.jogo] || '🎮'} ${GAME_NAMES[t.jogo] || t.jogo} · ${t.data_txt || 'Sem data'}</div>
            <div style="font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-top:4px">${t.nome}</div>
          </div>
          <span class="mini-badge ${statusClass}">${statusLabel}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:12px;flex-wrap:wrap;font-family:'Rajdhani',sans-serif;">
          <span>👥 <strong style="color:var(--text)">${inscs}/${t.vagas}</strong></span>
          <span>💰 <strong style="color:var(--gold)">R$${t.taxa || 0}</strong> entrada</span>
          <span>🏆 <strong style="color:var(--success)">R$${t.premio || 0}</strong> prêmio</span>
          <span>📈 <strong style="color:${lucroEstimado >= 0 ? 'var(--success)' : 'var(--danger)'}">R$${lucroEstimado.toFixed(2)}</strong> lucro estimado</span>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px;font-family:'Inter',sans-serif;">
          Arrecadação prevista: <strong style="color:var(--text)">R$${arrecadacaoPrevista.toFixed(2)}</strong>
        </div>
        <div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;margin-bottom:14px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--gold),var(--gold2));width:${pct}%"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-admin sm" style="background:rgba(0,229,160,.08);border:1px solid rgba(0,229,160,.2);color:var(--success)" onclick="verInscritos('${t.id}','${t.nome}')">👥 Inscritos</button>
          
          ${t.status === 'aberto' ? 
            `<button class="btn-admin gold sm" onclick="iniciarTorneio('${t.id}')">⚡ Iniciar Torenio (Gerar Chaves)</button>` : ''
          }
          ${isEmAndamento ? 
             `<button class="btn-admin purple sm" onclick="gerenciarPartidas('${t.id}', '${t.nome}')">⚔️ Gerenciar Partidas</button>` : ''
          }
          <button class="btn-admin danger sm" onclick="deleteTorneio('${t.id}')">🗑️ ${isFinalizado ? 'Excluir Histórico' : 'Excluir'}</button>
        </div>
      </div>`;
  }).join('');
}

async function iniciarTorneio(id) {
  if (!(await uiConfirm('Iniciar Torneio', 'Esta ação fechará as inscrições e gerará o chaveamento oficial das partidas. Os perdedores por W.O. serão calculados. Continuar?'))) return;
  const r = await apiAdmin(`/api/torneios/${id}/start`, { method: 'POST' });
  const d = await r.json();
  if (r.ok) {
     showToast('✅ ' + d.message, 'success');
     await loadAllTorneios();
     await loadDashboard();
  } else {
     showToast('⚠️ Erro: ' + d.error, 'error');
  }
}
window.iniciarTorneio = iniciarTorneio;

async function gerenciarPartidas(id, nome) {
  document.getElementById('partidas-torneio-nome').textContent = nome;
  document.getElementById('modal-partidas').classList.add('show');
  
  const cont = document.getElementById('partidas-list');
  cont.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div> Carregando chaves...</div>';
  
  const r = await apiAdmin('/api/matches/torneio/' + id);
  const matches = await r.json();
  
  if (!matches.length) {
      cont.innerHTML = '<div style="text-align:center;color:var(--muted)">Nenhuma partida gerada.</div>';
      return;
  }
  
  cont.innerHTML = matches.map(m => {
      let stColor = 'var(--muted)';
      let stTxt = 'Aguardando Luta';
      
      if (m.status === 'awaiting_result') { stTxt = 'Pendente Confirmação'; stColor = 'var(--gold)'; }
      if (m.status === 'disputed') { stTxt = '⚠️ EM DISPUTA'; stColor = 'var(--danger)'; }
      if (m.status === 'finished') { stTxt = 'Finalizada'; stColor = 'var(--success)'; }
      
      const p1Nome = m.p1_name || '(?/Bye)';
      const p2Nome = m.p2_name || '(?/Bye)';
      
      const isP1Win = m.winner_id === m.player1_id;
      const isP2Win = m.winner_id === m.player2_id;
      const bcColor = m.status === 'disputed' ? 'var(--danger)' : 'var(--border)';
      
      let html = '<div style="background:var(--bg-card);border:1px solid ' + bcColor + ';border-radius:12px;padding:12px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:8px">' +
              '<span style="font-family:\'Orbitron\';color:var(--gold);font-size:12px">Round ' + m.round + ' · Match ' + m.match_number + '</span>' +
              '<span style="font-size:11px;font-weight:bold;color:' + stColor + '">' + stTxt + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.2);padding:8px;border-radius:8px">' +
                '<div style="flex:1;text-align:center;font-weight:' + (isP1Win ? '800;color:var(--gold)' : 'normal') + '">' + p1Nome + '</div>' +
                '<div style="padding:0 12px;color:var(--muted);font-size:10px;font-family:\'Orbitron\'">VS</div>' +
                '<div style="flex:1;text-align:center;font-weight:' + (isP2Win ? '800;color:var(--gold)' : 'normal') + '">' + p2Nome + '</div>' +
            '</div>';
      
      if (m.status !== 'finished' && m.player1_id && m.player2_id) {
          html += '<div style="display:flex;gap:8px;margin-top:12px;justify-content:center">' +
                '<button class="btn-admin sm" style="flex:1;background:rgba(0,255,0,.1);color:var(--success)" onclick="resolverAdmin(\'' + m.id + '\', ' + m.player1_id + ', \'' + m.torneio_id + '\', \'' + nome + '\')">Dar Vit. ' + p1Nome + '</button>' +
                '<button class="btn-admin sm" style="flex:1;background:rgba(0,255,0,.1);color:var(--success)" onclick="resolverAdmin(\'' + m.id + '\', ' + m.player2_id + ', \'' + m.torneio_id + '\', \'' + nome + '\')">Dar Vit. ' + p2Nome + '</button>' +
            '</div>';
      }
      return html + '</div>';
  }).join('');
}
window.gerenciarPartidas = gerenciarPartidas;

async function resolverAdmin(matchId, winnerId, torneioId, tNome) {
    if(!(await uiConfirm('Resolver Partida', 'Avançar este jogador na chave e/ou encerrar o torneio?'))) return;
    const r = await apiAdmin('/api/matches/' + matchId + '/resolve', { 
       method: 'POST', 
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ winnerId }) 
    });
    
    if (r.ok) {
       showToast('✅ Solucionado', 'success');
       gerenciarPartidas(torneioId, tNome);
       loadAllTorneios(); // Atualiza se foi finalizado
    } else {
       const err = await r.json();
       showToast('Erro: ' + (err.error || 'Falha'), 'error');
    }
}
window.resolverAdmin = resolverAdmin;

async function deleteTorneio(id) {
  if (!(await uiConfirm('Excluir Torneio', 'Excluir este torneio permanentemente? O histórico não poderá ser recuperado.'))) return;
  const r = await apiAdmin(`/api/torneios/${id}`, { method: 'DELETE' });
  if (r.ok) { showToast('🗑️ Torneio excluído', 'info'); await loadAllTorneios(); await loadDashboard(); }
  else showToast('Erro ao excluir', 'error');
}

async function verInscritos(id, nome) {
  const r    = await apiAdmin(`/api/torneios/${id}/inscritos`);
  const list = await r.json();
  if (!list.length) { showToast('Nenhum inscrito ainda', 'info'); return; }
  
  const contentHTML = list.map(u => `• <strong style="color:var(--gold)">${u.name}</strong> <span style="color:var(--muted)">(${u.phone || 'Sem número'})</span>`).join('<br>');
  uiAlert(`Inscritos: ${nome}`, contentHTML);
}

window.deleteTorneio = deleteTorneio;
window.verInscritos  = verInscritos;

/* ── USUÁRIOS ── */
async function loadUsers() {
  const r        = await apiAdmin('/api/users');
  const users    = await r.json();
  const container = document.getElementById('users-list');
  const avatars  = ['🦁', '🐺', '🦊', '🐯', '🦅', '🐉', '🦈', '🐸', '🦋', '🦜'];

  document.getElementById('users-count').textContent = users.length + ' usuários';

  if (!users.length) {
    container.innerHTML = '<div class="loading-placeholder">Nenhum usuário cadastrado</div>';
    return;
  }

  container.innerHTML = users.map((u, i) => `
    <div class="user-card">
      <div class="user-avatar">${avatars[i % 10]}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-meta">📱 ${u.phone || '-'} · 🎮 ${u.inscricoes_count || 0} inscrições · ${new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
      </div>
      <div>
        <div class="user-saldo">R$${(u.saldo || 0).toFixed(2)}</div>
        <button class="btn-admin danger sm" style="margin-top:6px;width:100%" onclick="deleteUser(${u.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function deleteUser(id) {
  if (!(await uiConfirm('Excluir Usuário', 'Tem certeza que deseja excluir permanentemente este usuário da plataforma?'))) return;
  const r = await apiAdmin(`/api/users/${id}`, { method: 'DELETE' });
  if (r.ok) { showToast('🗑️ Usuário excluído', 'info'); await loadUsers(); await loadDashboard(); }
  else showToast('Erro ao excluir', 'error');
}

window.deleteUser = deleteUser;

/* ── CONFIG ── */
async function loadConfig() {
  const r   = await apiAdmin('/api/config');
  const cfg = await r.json();
  document.getElementById('pix-current-display').textContent = cfg.pix_key || 'arena@amadora.com';
  document.getElementById('cfg-nome').value = cfg.arena_nome || 'Arena Amadora';
  await loadAuditLogs();
}

function getAuditFilters() {
  return {
    action: document.getElementById('audit-action').value.trim(),
    resourceType: document.getElementById('audit-resource').value.trim(),
    actorId: document.getElementById('audit-actor-id').value.trim()
  };
}

function buildAuditQuery(page = auditPage) {
  const filters = getAuditFilters();
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(auditLimit));
  if (filters.action) params.set('action', filters.action);
  if (filters.resourceType) params.set('resourceType', filters.resourceType);
  if (filters.actorId) params.set('actorId', filters.actorId);
  return params.toString();
}

async function loadAuditLogs(page = auditPage) {
  auditPage = page;
  const tbody = document.getElementById('audit-body');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Carregando...</td></tr>';

  const r = await apiAdmin('/api/audit?' + buildAuditQuery(page));
  const data = await r.json();

  if (!data.items.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Nenhum registro encontrado.</td></tr>';
  } else {
    tbody.innerHTML = data.items.map(item => {
      const dt = new Date(item.created_at).toLocaleString('pt-BR');
      const recurso = [item.resource_type || '-', item.resource_id || '-'].join(' #');
      return `
        <tr>
          <td>${dt}</td>
          <td style="font-family:'Rajdhani',sans-serif;font-weight:700;">${item.action}</td>
          <td>${recurso}</td>
          <td>${item.actor_id ?? '-'}</td>
          <td>${item.ip || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('audit-page-info').textContent = `Página ${data.pagination.page} de ${data.pagination.totalPages} (${data.pagination.total} registros)`;
  document.getElementById('btn-audit-prev').disabled = !data.pagination.hasPrev;
  document.getElementById('btn-audit-next').disabled = !data.pagination.hasNext;
}

document.getElementById('btn-salvar-pix').addEventListener('click', async () => {
  const val = document.getElementById('pix-nova').value.trim();
  if (!val) return showToast('⚠️ Informe a chave PIX', 'error');
  const r = await apiAdmin('/api/config', { method: 'PUT', body: JSON.stringify({ pix_key: val }) });
  if (r.ok) { document.getElementById('pix-nova').value = ''; await loadConfig(); showToast('✅ Chave PIX salva!', 'success'); }
  else showToast('Erro ao salvar', 'error');
});

document.getElementById('btn-salvar-cfg').addEventListener('click', async () => {
  const nome = document.getElementById('cfg-nome').value.trim();
  const r    = await apiAdmin('/api/config', { method: 'PUT', body: JSON.stringify({ arena_nome: nome }) });
  if (r.ok) showToast('✅ Configurações salvas!', 'success');
  else showToast('Erro ao salvar', 'error');
});

document.getElementById('btn-limpar-torneios').addEventListener('click', async () => {
  if (!(await uiConfirm('AÇÃO CRÍTICA', 'Excluir TODOS os torneios de uma vez? Essa ação não tem volta.'))) return;
  const torneios = await (await apiAdmin('/api/torneios')).json();
  await Promise.all(torneios.map(t => apiAdmin(`/api/torneios/${t.id}`, { method: 'DELETE' })));
  showToast('🗑️ Torneios removidos', 'info');
  await loadDashboard();
  document.getElementById('all-torneios-list').innerHTML = '<div class="loading-placeholder">Nenhum torneio</div>';
});

document.getElementById('btn-audit-filtrar').addEventListener('click', async () => {
  await loadAuditLogs(1);
});

document.getElementById('btn-audit-limpar').addEventListener('click', async () => {
  document.getElementById('audit-action').value = '';
  document.getElementById('audit-resource').value = '';
  document.getElementById('audit-actor-id').value = '';
  await loadAuditLogs(1);
});

document.getElementById('btn-audit-prev').addEventListener('click', async () => {
  if (auditPage > 1) await loadAuditLogs(auditPage - 1);
});

document.getElementById('btn-audit-next').addEventListener('click', async () => {
  await loadAuditLogs(auditPage + 1);
});

document.getElementById('btn-audit-export').addEventListener('click', () => {
  window.open('/api/audit/export.csv?' + buildAuditQuery(1), '_blank');
});

/* ── SAQUES (WITHDRAWALS) ── */
async function loadSaques() {
  const r = await apiAdmin('/api/withdrawals');
  const saques = await r.json();
  const container = document.getElementById('saques-list');

  if (!saques.length) {
    container.innerHTML = '<div class="loading-placeholder">Nenhume solicitação de saque pendente.</div>';
    return;
  }

  container.innerHTML = saques.map((s, i) => {
      let badges = '';
      if (s.status === 'pending') badges = '<span class="t-badge breve">Pendente</span>';
      else if (s.status === 'approved') badges = '<span class="t-badge aberto">Aprovado</span>';
      else badges = '<span class="t-badge cheio">Rejeitado</span>';

      return `
      <div style="background:rgba(16,18,26,.85);border:1px solid var(--border);border-radius:18px;padding:18px;margin-bottom:12px;backdrop-filter:blur(12px); animation: fadeUp 0.5s var(--ease-out-expo) forwards; animation-delay: ${i * 0.05}s; opacity: 0;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text)">${s.user_name}</div>
                <div style="font-size:12px;color:var(--muted)">Telefone: ${s.user_phone || 'Não informado'}</div>
            </div>
            <div style="text-align:right">
                <div style="font-family:'Orbitron',sans-serif;font-size:18px;font-weight:900;color:var(--success)">R$ ${s.amount.toFixed(2)}</div>
                ${badges}
            </div>
        </div>
        <div style="background:rgba(255,215,0,.05);border:1px solid rgba(255,215,0,.15);padding:10px;border-radius:8px;margin-bottom:12px;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Chave PIX Recebedor:</div>
            <div style="font-family:'Orbitron',sans-serif;font-size:14px;color:var(--gold);word-break:break-all">${s.pix_key}</div>
        </div>
        
        ${s.status === 'pending' ? `
            <div style="display:flex;gap:10px">
                <button class="btn-admin purple" style="flex:1;font-size:12px;padding:10px" onclick="processarSaque('${s.id}', 'approved')">✅ Aprovar</button>
                <button class="btn-admin danger" style="flex:1;font-size:12px;padding:10px" onclick="processarSaque('${s.id}', 'rejected')">❌ Rejeitar</button>
            </div>
        ` : `
            <div style="font-size:12px;color:var(--muted)">Processado em: ${new Date(s.created_at).toLocaleString('pt-BR')} ${s.admin_note ? '<br>Motivo: ' + s.admin_note : ''}</div>
        `}
      </div>
      `;
  }).join('');
}

async function processarSaque(id, status) {
    let msg = status === 'approved' 
        ? 'Deseja confirmar que você já realizou a transferência deste PIX?' 
        : 'Tem certeza que deseja REJEITAR este saque devolvendo o dinheiro a carteira do usuário?';
        
    if (!(await uiConfirm('Confirmar Processamento', msg))) return;
    
    let note = '';
    if (status === 'rejected') {
        note = await uiPrompt('Motivo da Rejeição', 'Qual o motivo da rejeição? (Ex: Chave PIX Incorreta/Fraude)', 'Chave errada');
        if (!note) return showToast('Processamento cancelado.', 'error');
    }

    const r = await apiAdmin('/api/withdrawals/' + id + '/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note })
    });
    
    if (r.ok) {
        showToast('Saque processado com sucesso!', 'success');
        loadSaques();
        loadDashboard(); // Para atualizar estatísticas financeiras depois se houver
    } else {
        showToast('Erro ao processar', 'error');
    }
}
window.processarSaque = processarSaque;

/* ── NAVEGAÇÃO ── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'dashboard') loadDashboard();
    if (page === 'torneios')  loadAllTorneios();
    if (page === 'usuarios')  loadUsers();
    if (page === 'saques')    loadSaques();
    if (page === 'config')    loadConfig();
    if (page === 'auditoria') loadAuditLogs(1);
  });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

init();
updatePricingPreview();
