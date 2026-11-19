import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || '';

// Em producao o segredo do JWT e obrigatorio: sem ele qualquer um conseguiria forjar um token.
if (nodeEnv === 'production' && (!jwtSecret || jwtSecret.length < 24)) {
  throw new Error('JWT_SECRET ausente ou curto demais (minimo 24 caracteres) em producao.');
}

export const config = {
  // so usado no desenvolvimento local (na Vercel a API roda como funcao, sem listen)
  port: Number(process.env.PORT) || 3341,
  nodeEnv,
  jwtSecret: jwtSecret || 'cidade-nobre-dev-secret-troque-em-producao',
  // equipe fica logada por 7 dias; cliente por 30 (so le os proprios pontos e agendamentos)
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtClienteExpiresIn: process.env.JWT_CLIENTE_EXPIRES_IN || '30d',
  // fuso do negocio: "hoje", "agora" e os horarios da agenda seguem este fuso
  timezone: process.env.TZ_NEGOCIO || 'America/Sao_Paulo',
  // Em producao o site e a API ficam no mesmo dominio (/api), entao CORS nao e necessario.
  // Preencha CORS_ORIGINS so se o front rodar em outro endereco.
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Endereco publico do site (volta do pagamento, aviso do Mercado Pago e volta do OAuth).
  siteUrl: (process.env.SITE_URL || 'https://cidadenobre.147-93-145-137.sslip.io').replace(/\/+$/, ''),
  // Loja do Doutor do Celular (Kauan Cell): a vitrine de acessorios do inicio vem do catalogo publico dela
  doutorUrl: (process.env.DOUTOR_URL || 'https://doutordocelular.147-93-145-137.sslip.io').replace(/\/+$/, ''),
  // Mercado Pago: o app e da SMG (client_id/secret no .env); a barbearia conecta a conta
  // dela por OAuth e o dinheiro cai la. A SMG fica com a comissao (marketplace_fee).
  mercadoPago: {
    apiBaseUrl: (process.env.MERCADO_PAGO_API_BASE_URL || 'https://api.mercadopago.com').replace(/\/+$/, ''),
    clientId: process.env.MERCADO_PAGO_CLIENT_ID || '',
    clientSecret: process.env.MERCADO_PAGO_CLIENT_SECRET || '',
    redirectUri: process.env.MERCADO_PAGO_OAUTH_REDIRECT_URI || '',
    taxaPlataformaPct: Number(process.env.MERCADO_PAGO_TAXA_PLATAFORMA_PCT ?? 2),
    // tempo para pagar; depois disso o horario volta a ficar livre
    prazoPagamentoMin: Number(process.env.MERCADO_PAGO_PRAZO_MINUTOS || 30),
  },
};
