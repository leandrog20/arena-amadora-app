/* ═══════════════════════════════════════════════
   login.js — Lógica da página de login e cadastro
   ═══════════════════════════════════════════════ */

/* ── PARTÍCULAS ── */
(function initParticles() {
  const pc = document.getElementById('particles');
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDuration = (8 + Math.random() * 16) + 's';
    p.style.animationDelay = (Math.random() * 18) + 's';
    const sz = (1 + Math.random() * 2.5) + 'px';
    p.style.width = sz;
    p.style.height = sz;
    p.style.opacity = '0';
    pc.appendChild(p);
  }
})();

/* ── MÁSCARA DE TELEFONE ── */
document.getElementById('reg-phone').addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 6)      v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
  else if (v.length > 2) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
  else if (v.length > 0) v = '(' + v;
  this.value = v;
});

/* ── TABS ── */
document.getElementById('tab-login').addEventListener('click', () => switchTab('login'));
document.getElementById('tab-register').addEventListener('click', () => switchTab('register'));

function switchTab(t) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
  document.getElementById('panel-' + t).classList.add('active');
}

/* ── HELPERS DE ALERTA ── */
function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = (type === 'error' ? '⚠️ ' : '') + msg;
  el.className = 'alert ' + type + ' show';
}

function hideAlert(id) {
  document.getElementById(id).className = 'alert';
}

/* ── CADASTRO ── */
document.getElementById('btn-register').addEventListener('click', async () => {
  const name     = document.getElementById('reg-name').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-pass').value;

  hideAlert('reg-error');
  hideAlert('reg-success');

  if (!name || !phone || !password) return showAlert('reg-error', 'Preencha todos os campos.');
  if (password.length < 6) return showAlert('reg-error', 'Senha deve ter ao menos 6 caracteres.');

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Criando conta...';

  try {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password })
    });
    const d = await r.json();
    if (!r.ok) return showAlert('reg-error', d.error || 'Erro ao criar conta.');
    showAlert('reg-success', '✅ Conta criada! Faça login.', 'success');
    document.getElementById('reg-name').value  = '';
    document.getElementById('reg-phone').value = '';
    document.getElementById('reg-pass').value  = '';
    setTimeout(() => switchTab('login'), 1500);
  } catch (e) {
    showAlert('reg-error', 'Erro de conexão. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = '🎮 Criar Conta';
  }
});

/* ── LOGIN ── */
document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const name     = document.getElementById('login-name').value.trim();
  const password = document.getElementById('login-pass').value;

  hideAlert('login-error');
  if (!name || !password) return showAlert('login-error', 'Preencha todos os campos.');

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    const d = await r.json();
    if (!r.ok) return showAlert('login-error', d.error || 'Credenciais inválidas.');
    window.location.href = d.role === 'admin' ? '/admin.html' : '/index.html';
  } catch (e) {
    showAlert('login-error', 'Erro de conexão. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Entrar na Arena';
  }
}

/* ── VERIFICA SESSÃO ATIVA ── */
(async () => {
  try {
    const r = await fetch('/api/auth/me');
    if (r.ok) {
      const d = await r.json();
      window.location.href = d.role === 'admin' ? '/admin.html' : '/index.html';
    }
  } catch (e) { /* sem sessão, continua no login */ }
})();
