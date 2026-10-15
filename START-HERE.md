# Instalar a versão com arbitragem

Esta cópia contém os módulos React e a API de arbitragem, além do núcleo original. Não inclui o teu `.env`, passwords, chaves, `node_modules` nem dados da tua BD. Mantém o teu `.env` e o certificado CA atuais.

1. Extrai o ZIP para uma pasta nova e abre-a no VS Code.
2. Copia o `.env` e `supabase-ca.crt` da tua pasta atual para a raiz desta nova pasta. Não os coloques no Git.
3. No terminal desta pasta:

```sh
nvm install 22
nvm use 22
npm ci --include=dev
npm run migrate:arbitration
npm run build
npm start
```

O comando `migrate:arbitration` aplica apenas `server/migrations/002_arbitration.postgres.sql`: cria as novas tabelas e índices sem apagar os utilizadores, mensagens ou documentos existentes. Em alternativa, cola esse ficheiro no SQL Editor do teu Supabase e executa-o. Não voltes a executar a migração 001 numa base já instalada.

A aplicação passa a carregar automaticamente `./supabase-ca.crt`, se existir. Não é preciso desativar a validação SSL. Se o teu npm ainda chamar outra versão do Node, usa diretamente `"$(nvm which 22)" server/index.js`.

## Dados existentes

As contas mantêm o mesmo email e PIN. Como o núcleo antigo não tinha qualificações completas, o CA deve abrir **Gestão → Qualificações** (ou Utilizadores → ficha) e atribuir funções e níveis. Sem funções atribuídas, uma pessoa não pode ser proposta para essa função.

Os torneios do HTML eram dados de demonstração em memória; não são importados para a tua BD real automaticamente.

## Dados de demonstração opcionais

Só numa BD de teste **sem utilizadores**, depois de instalar o schema:

```sh
npm run seed:arbitration
```

Cria o conjunto de exemplo do protótipo (32 pessoas, 27 torneios, disponibilidades, nomeações, avaliações e caderneta), com emails `@example.test`. Não envia emails. Se houver qualquer utilizador, não altera nada. As datas desse conjunto correspondem ao protótipo de outubro de 2026.

Contas de exemplo: `ca1@example.test` / `3690`, `ja1@example.test` / `1470`, `a1@example.test` / `2580`. Não uses estas contas conhecidas numa instalação pública com dados reais.

## Render

- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm start`
- Node: 22.x (fixado em package.json).
- Mantém DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, buckets, PUBLIC_URL e variáveis de email.
- NODE_ENV=production e TRUST_PROXY=1.
- Se usares Secret Files, define DATABASE_CA_CERT_PATH=/etc/secrets/supabase-ca.crt. O NODE_EXTRA_CA_CERTS que já tinhas configurado também pode permanecer.
- Aplica a migração 002 antes de disponibilizar as novas páginas.

O ficheiro `render.yaml` descreve o serviço sem guardar credenciais.

## Vercel

Mantém `vercel.json`, configura as mesmas variáveis no ambiente correto e faz redeploy. Para SSL podes definir DATABASE_CA_CERT com o conteúdo PEM completo do certificado. A chave de serviço permanece apenas no servidor.

## O que foi verificado

Build de produção; testes do núcleo, API e domínio; privacidade e permissões; importação CSV/TSV; estrutura/XML das cinco folhas da caderneta Excel. Inspeção no navegador: login, calendário, criação de torneios com datas, diretório, caderneta e formulários de qualificações.

O teste de integração com Postgres real é opt-in (`TEST_DATABASE_URL=... npm run test:postgres`): não foi executado contra a tua BD. Não houve deploy nem alteração remota. A interface utiliza o design e os fluxos do HTML em componentes React; não foi certificada como cópia pixel a pixel. O ecrã de importação usa uma tabela editável em vez do editor expandido do protótipo. Nos emails, cada destinatário recebe a mensagem individualmente, preservando a privacidade; os responsáveis recebem a mesma convocatória.

## Estrutura

- `shared/arbitration.js`: constantes e cálculos partilhados.
- `server/modules/arbitration/engine.js`: regras e validações por operação.
- `server/modules/arbitration/routes.js`: API, transações e persistência.
- `client/src/arbitration/`: componentes React, importação e Excel.
- `server/migrations/002_arbitration.postgres.sql`: migração aditiva.
- `test/`: testes, fixtures e integração Postgres opcional.

A escrita de arbitragem é serializada por uma transação com advisory lock. É adequada à escala inicial desta app; para volumes elevados, devem acrescentar-se paginação e consultas específicas em vez de carregar o snapshot do domínio inteiro. O limitador por IP do núcleo continua a ser por instância.
