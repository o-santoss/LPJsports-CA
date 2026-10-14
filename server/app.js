// Definição da app que corre em cima da base.
// Cada app da LPJ Sports (C.Arbitragem, Live Scoring, …) tem o seu ficheiro destes:
// nome, papéis de utilizador, listas de escolha e módulos ligados.

export const APP = {
  key: 'c-arbitragem',
  name: 'C.Arbitragem',
  tagline: 'Nomeações · Ténis',
  org: 'Conselho de Arbitragem',
  owner: 'LPJ Sports',
  ownerUrl: 'https://www.lpjsports.pt',
  // Papéis por ordem crescente de permissões: cada papel faz tudo o que o anterior faz.
  roles: [
    { key: 'arb', label: 'Árbitro', plural: 'Árbitros' },
    { key: 'ja', label: 'JA / Chefe de Árbitros', plural: 'JA e Chefes de Árbitros' },
    { key: 'ca', label: 'Conselho de Arbitragem', plural: 'Conselho de Arbitragem', admin: true },
  ],
  defaultRole: 'arb',
  regions: ['Norte', 'Centro', 'Lisboa', 'Alentejo', 'Algarve', 'Madeira', 'Açores'],
  assocs: [
    'Associação de Ténis dos Açores', 'Associação de Ténis do Alentejo', 'Associação de Ténis do Algarve',
    'Associação de Ténis de Aveiro', 'Associação de Ténis de Castelo Branco', 'Associação de Ténis de Coimbra',
    'Associação de Ténis de Leiria', 'Associação de Ténis de Lisboa', 'Associação de Ténis da Madeira',
    'Associação de Ténis do Porto', 'Associação de Ténis de Setúbal', 'Associação de Ténis de Vila Real',
    'Associação de Ténis de Viseu',
  ],
  docCats: ['Regulamentos', 'Regras', 'Remunerações', 'Circulares', 'Formação', 'Outros'],
  docExt: ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'zip', 'png', 'jpg', 'jpeg'],
  // Módulos ligados nesta instalação (o núcleo está sempre ligado).
  modules: [],
};

export const roleIndex = (key) => APP.roles.findIndex((r) => r.key === key);
export const roleLabel = (key) => APP.roles.find((r) => r.key === key)?.label || key;
export const adminRole = () => APP.roles.find((r) => r.admin)?.key || APP.roles[APP.roles.length - 1].key;
// true se o papel do utilizador é igual ou superior ao pedido
export const hasRole = (user, key) => !!user && roleIndex(user.role) >= roleIndex(key);
export const isAdmin = (user) => hasRole(user, adminRole());
