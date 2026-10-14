# Base LPJ Sports

O núcleo comum das apps da **LPJ Sports**: contas, perfis, notificações, emails, documentos e a imagem LPJ.
Cada app (C.Arbitragem, Live Scoring, …) corre em cima desta base. A primeira é a **C.Arbitragem**.

- **Frontend:** React 19 (pasta `client/`), compilado com esbuild para `public/`
- **Backend:** Node.js 22, sem frameworks externos (pasta `server/`)
- **Base de dados:** SQL (SQLite incluído no Node). Uma cópia de segurança é copiar a pasta `data/`. O acesso à base de dados está todo em `server/core/db.js`, por isso é possível passar para PostgreSQL ou MariaDB sem mexer no resto.
- **Emails:** Brevo (API). Sem chave configurada, os emails ficam registados como "simulado".

## O que a base já faz

| Área | O que inclui |
|---|---|
| Contas | Criar conta (fica por aprovar), entrar com email ou telemóvel e código de 4 algarismos, bloqueio após 5 tentativas erradas, recuperar o código por email |
| Perfis | Dados pessoais, associação (13 associações), foto de perfil, preferências de email, mudar o código, descarregar os meus dados (RGPD) |
| Papéis | Definidos por app em `server/app.js` (na C.Arbitragem: Árbitro → JA/Chefe → Conselho de Arbitragem); cada papel faz tudo o que o anterior faz |
| Notificações | Caixa de entrada, mensagens para pessoas ou grupos, respostas, marcar como lido; segue por email conforme as preferências |
| Documentos | Publicar ficheiros ou links, por categoria e público, aviso de documento novo, contagem de quem viu |
| Administração | Aprovar/recusar registos, criar e editar utilizadores, desbloquear contas, ver todos os emails e o registo de ações |
| Aparência | Marca LPJ Sports, 6 paletas de cores, modo claro/escuro, pensada para telemóvel |

## Correr no computador

Precisa do [Node.js 22](https://nodejs.org) ou mais recente.

```bash
npm install
npm run build          # compila a app React
npm run seed:demo      # contas de exemplo (só numa base vazia)
npm start              # abre em http://localhost:3000
```

Contas de exemplo: `teresa.antunes@exemplo.pt` · 3690 (CA), `miguel.santos@exemplo.pt` · 1470 (JA), `ana.rodrigues@exemplo.pt` · 2468 (Árbitro).

Para trabalhar no código com recompilação automática: `npm run dev`. Testes: `npm test`.

## Pôr online

1. Escolher um alojamento para Node.js com **disco permanente** (a base de dados e os ficheiros ficam na pasta `DATA_DIR`). Por exemplo: Render (Web Service + Disk), Railway (com Volume) ou um servidor próprio (VPS).
2. Comando de compilação: `npm install && npm run build` · Comando de arranque: `npm start`.
3. Variáveis de ambiente (ver `.env.example`): `NODE_ENV=production`, `TRUST_PROXY=1`, `PUBLIC_URL`, `DATA_DIR` (no disco permanente), `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PIN`, e as do Brevo.
4. No Brevo: confirmar o domínio de envio (SPF e DKIM) e criar uma chave de API.
5. Endereço próprio (ex.: `arbitragem.lpjsports.pt`): acrescentar um registo CNAME na configuração do domínio.

## Cópias de segurança

Copiar diariamente a pasta `DATA_DIR` (ficheiro `app.db` e pasta `uploads/`). A maior parte dos alojamentos faz isto com snapshots do disco.

## Segurança

- Códigos guardados com scrypt (nunca em texto), sessões em cookie HttpOnly e SameSite, cookies só por https em produção
- Bloqueio de 15 minutos após 5 códigos errados e limite de tentativas por IP
- Pedidos que alteram dados exigem o cabeçalho `X-LPJ` (proteção contra pedidos de outros sites)
- Cabeçalhos de segurança (CSP, X-Frame-Options, nosniff) e validação de todos os dados recebidos
- Fotos e documentos só para quem tem sessão; documentos respeitam o público escolhido
- Registo de ações importantes (entradas, aprovações, alterações)

## Estrutura

```
server/
  index.js            arranque do servidor e encaminhamento dos pedidos
  app.js              definição da app (nome, papéis, listas) — muda por app
  config.js           variáveis de ambiente
  core/               núcleo: base de dados, sessões, emails, ficheiros, validação
  modules/core/       rotas do núcleo (contas, perfil, mensagens, documentos, admin)
  migrations/         estrutura da base de dados (ficheiros .sql por ordem)
client/
  index.html
  src/App.jsx         moldura da app, sessão e navegação
  src/auth/           entrar, criar conta, recuperar código
  src/pages/          Início, Notificações, Documentos, Utilizadores, Perfil, Ajuda
  src/ui/             peças reutilizáveis (ícones, logótipo LPJ, janelas, campos)
scripts/              compilação e dados de demonstração
test/                 testes automáticos da API
```

## Próximo passo

Módulo **C.Arbitragem**: torneios (com e sem nomeação do CA), vários torneios de uma vez e importação do Excel, disponibilidades, propostas e nomeações, convocatórias, avaliações, caderneta com exportação para Excel, pesquisa de árbitros e torneios.

---
© LPJ Sports · www.lpjsports.pt
