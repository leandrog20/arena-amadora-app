# 🏆 Arena Amadora — Backend com Node.js + Express + SQLite

## Estrutura do Projeto

```
arena-amadora/
├── server.js              # Servidor principal
├── package.json
├── .env.example           # Copie para .env
├── .gitignore
├── db/
│   └── database.js        # Schema e conexão SQLite
├── routes/
│   ├── auth.js            # Login, registro, JWT
│   ├── torneios.js        # CRUD de torneios + inscrições
│   ├── users.js           # Usuários, carteira, ranking
│   └── config.js          # Configurações, estatísticas
└── public/
    ├── login.html
    ├── index.html
    └── admin.html
```

---

## 🖥️ Rodar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Copiar .env
cp .env.example .env

# 3. Rodar
npm start
# ou com hot reload:
npm run dev

# 4. Acessar
# http://localhost:3000/login.html
```

**Login admin:** usuário `admin` / senha `admin123`

---

## 🚀 Deploy no Railway (Recomendado para SQLite)

Railway suporta disco persistente — ideal para SQLite.

### Passo a passo:

1. Crie conta em [railway.app](https://railway.app)
2. Clique em **New Project → Deploy from GitHub**
3. Conecte este repositório
4. Vá em **Variables** e adicione:
   ```
   JWT_SECRET=uma_string_aleatoria_longa_aqui
   ADMIN_PASSWORD=sua_senha_segura
   NODE_ENV=production
   ALLOWED_ORIGINS=https://arena-amadora-app-production.up.railway.app
   ```
5. Railway detecta `package.json` e roda `npm start` automaticamente
6. Acesse a URL gerada pelo Railway

### Persistência do banco no Railway:
- Vá em **Settings → Volumes**
- Adicione um volume montado em `/app/db`
- Isso garante que o SQLite não seja apagado nos deploys

---

## 🌐 Deploy no Render (alternativa)

> ⚠️ No Render free tier, o disco é efêmero — o banco SQLite é resetado a cada deploy.
> Use Railway para persistência, ou migre para PostgreSQL no Render.

1. Crie conta em [render.com](https://render.com)
2. New → **Web Service** → conecte o repositório
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Adicione as variáveis de ambiente (JWT_SECRET, ADMIN_PASSWORD)

---

## 🔌 Endpoints da API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/register` | — | Cadastrar usuário |
| POST | `/api/auth/login` | — | Login (retorna cookie JWT) |
| POST | `/api/auth/logout` | — | Logout |
| GET | `/api/auth/me` | ✅ | Dados do usuário logado |
| GET | `/api/torneios` | ✅ | Listar torneios |
| POST | `/api/torneios` | Admin | Criar torneio |
| DELETE | `/api/torneios/:id` | Admin | Excluir torneio |
| POST | `/api/torneios/:id/inscrever` | ✅ | Inscrever no torneio |
| GET | `/api/torneios/:id/inscritos` | Admin | Ver inscritos |
| GET | `/api/users` | Admin | Listar usuários |
| DELETE | `/api/users/:id` | Admin | Excluir usuário |
| GET | `/api/users/ranking` | ✅ | Ranking geral |
| GET | `/api/users/historico` | ✅ | Histórico de transações |
| POST | `/api/users/deposito` | ✅ | Simular depósito PIX |
| GET | `/api/config` | — | Configurações públicas |
| PUT | `/api/config` | Admin | Atualizar configurações |
| GET | `/api/config/stats` | Admin | Estatísticas do painel |

---

## 🔒 Segurança

- Senhas com **bcrypt** (hash + salt)
- Autenticação via **JWT em cookie HttpOnly**
- Inscrições com **transação atômica** no SQLite
- Middleware de autenticação separado por rota
- CORS configurado

---

## 📦 Dependências

| Pacote | Uso |
|--------|-----|
| express | Servidor HTTP |
| better-sqlite3 | Banco SQLite (síncrono, rápido) |
| bcryptjs | Hash de senhas |
| jsonwebtoken | Autenticação JWT |
| cors | Cross-Origin |
| cookie-parser | Leitura de cookies |
