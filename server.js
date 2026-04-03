require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/torneios', require('./routes/torneios'));
app.use('/api/users', require('./routes/users'));
app.use('/api/config', require('./routes/config'));

// ── SPA fallback ─────────────────────────────────────────
// Serve index.html para rotas não-API (permite navegação direta por URL)
app.get(/^(?!\/api).*/, (req, res) => {
  // Redireciona raiz para login se não autenticado (o frontend cuida disso)
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ── 404 JSON para rotas API desconhecidas ─────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

app.listen(PORT, () => {
  console.log(`🏆 Arena Amadora rodando em http://localhost:${PORT}`);
});
