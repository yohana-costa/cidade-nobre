import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import { falha } from '../lib/erros';

/*
 * Mercado Pago da barbearia.
 *
 * "Conectar Mercado Pago" (OAuth): o app e da SMG (client_id/secret no .env). A barbearia
 * autoriza na conta dela e guardamos o token na linha unica de configuracoes. Com esse
 * token as cobrancas caem na conta da barbearia e a SMG recebe a comissao (marketplace_fee),
 * que o Mercado Pago so aplica quando o token foi emitido pelo app da SMG.
 *
 * Este modulo so fala com a API do Mercado Pago; a regra do agendamento fica em
 * pagamentos.service.ts.
 */

const MP = config.mercadoPago;
const STATE_TTL = 15 * 60; // segundos para concluir a autorizacao

interface TokenOAuth { accessToken: string; refreshToken: string; userId: string; publicKey: string; expiresIn: number }

async function chamarOAuthToken(body: Record<string, string>): Promise<TokenOAuth> {
  const res = await fetch(`${MP.apiBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const d: any = await res.json().catch(() => ({}));
  if (!res.ok || !d?.access_token) throw falha(400, `Falha ao conectar com o Mercado Pago: ${d?.message || d?.error || `HTTP ${res.status}`}`);
  return { accessToken: d.access_token, refreshToken: d.refresh_token || '', userId: String(d.user_id ?? ''), publicKey: d.public_key || '', expiresIn: Number(d.expires_in || 0) };
}

const expiraEm = (seg: number) => (seg ? new Date(Date.now() + seg * 1000) : null);

/* ============ conexao (OAuth) ============ */
export const oauthConfigurado = () => !!(MP.clientId && MP.clientSecret && MP.redirectUri);

export function iniciarConexao() {
  if (!oauthConfigurado()) throw falha(400, 'A conexão com o Mercado Pago ainda não foi configurada no servidor.');
  const state = jwt.sign({ tipo: 'mp_oauth' }, config.jwtSecret, { expiresIn: STATE_TTL });
  const p = new URLSearchParams({ client_id: MP.clientId, response_type: 'code', platform_id: 'mp', state, redirect_uri: MP.redirectUri });
  return { url: `https://auth.mercadopago.com.br/authorization?${p.toString()}` };
}

export async function finalizarConexao(code: string, state: string) {
  try {
    const p = jwt.verify(state, config.jwtSecret) as { tipo?: string };
    if (p?.tipo !== 'mp_oauth') throw new Error('state');
  } catch {
    throw falha(400, 'Sessão de conexão expirada ou inválida. Conecte de novo.');
  }
  const t = await chamarOAuthToken({ client_id: MP.clientId, client_secret: MP.clientSecret, grant_type: 'authorization_code', code, redirect_uri: MP.redirectUri });
  await prisma.configuracao.update({
    where: { id: 1 },
    data: {
      mercadoPagoAccessToken: t.accessToken,
      mercadoPagoRefreshToken: t.refreshToken || null,
      mercadoPagoUserId: t.userId || null,
      mercadoPagoPublicKey: t.publicKey || null,
      mercadoPagoTokenExpiraEm: expiraEm(t.expiresIn),
    },
  });
}

export async function desconectar() {
  await prisma.configuracao.update({
    where: { id: 1 },
    data: { mercadoPagoAccessToken: null, mercadoPagoRefreshToken: null, mercadoPagoUserId: null, mercadoPagoPublicKey: null, mercadoPagoTokenExpiraEm: null },
  });
  return statusConexao();
}

export async function statusConexao() {
  const c = await prisma.configuracao.findUnique({ where: { id: 1 } });
  return {
    configurado: oauthConfigurado(),
    conectado: !!c?.mercadoPagoAccessToken,
    contaId: c?.mercadoPagoUserId || null,
    expiraEm: c?.mercadoPagoTokenExpiraEm || null,
    cobrarOnline: c?.cobrarOnline ?? true,
    prazoMinutos: MP.prazoPagamentoMin,
  };
}

export async function definirCobrarOnline(body: unknown) {
  const ligado = !!(body as { cobrarOnline?: unknown })?.cobrarOnline;
  await prisma.configuracao.update({ where: { id: 1 }, data: { cobrarOnline: ligado } });
  return statusConexao();
}

/*
 * Token da barbearia. Renova pelo refresh_token quando falta menos de 1 dia para vencer
 * (o token do OAuth dura cerca de 180 dias). Sem conta conectada devolve null.
 */
export async function tokenDaLoja(): Promise<string | null> {
  const c = await prisma.configuracao.findUnique({ where: { id: 1 } });
  const atual = c?.mercadoPagoAccessToken || null;
  if (!c || !atual) return null;
  const vence = c.mercadoPagoTokenExpiraEm ? c.mercadoPagoTokenExpiraEm.getTime() : 0;
  if (!c.mercadoPagoRefreshToken || !vence || vence - Date.now() > 24 * 3600 * 1000) return atual;
  try {
    const t = await chamarOAuthToken({ client_id: MP.clientId, client_secret: MP.clientSecret, grant_type: 'refresh_token', refresh_token: c.mercadoPagoRefreshToken });
    await prisma.configuracao.update({
      where: { id: 1 },
      data: { mercadoPagoAccessToken: t.accessToken, mercadoPagoRefreshToken: t.refreshToken || c.mercadoPagoRefreshToken, mercadoPagoTokenExpiraEm: expiraEm(t.expiresIn) },
    });
    console.log('[mercado-pago] token da barbearia renovado');
    return t.accessToken;
  } catch (e) {
    console.error('[mercado-pago] falha ao renovar o token da barbearia', e);
    return atual;
  }
}

// Cobranca no site: conta conectada e opcao ligada na gestao.
export async function tokenSeCobrarOnline(): Promise<string | null> {
  const c = await prisma.configuracao.findUnique({ where: { id: 1 }, select: { cobrarOnline: true } });
  if (!c?.cobrarOnline) return null;
  return tokenDaLoja();
}

/* ============ API de pagamentos ============ */
async function mp<T = any>(token: string, metodo: 'GET' | 'POST', caminho: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MP.apiBaseUrl}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[mercado-pago] ${metodo} ${caminho} -> HTTP ${res.status}`, d?.message || d);
    throw falha(502, 'O Mercado Pago não respondeu como esperado. Tente de novo em instantes.');
  }
  return d as T;
}

// Data no formato que o Mercado Pago aceita, com o fuso de Brasilia (-03:00).
const dataMp = (d: Date) => new Date(d.getTime() - 3 * 3600 * 1000).toISOString().replace('Z', '-03:00');

// Comissao da SMG em reais (o campo e numero na API de preferencias).
export const taxaPlataforma = (centavos: number) => {
  const pct = MP.taxaPlataformaPct;
  return pct > 0 ? Math.round((centavos * pct) / 100) / 100 : 0;
};

export const referenciaDe = (agendamentoId: string) => `agendamento-${agendamentoId}`;

// agendamentoId e o id do item; pedidos do bar mandam referencia e volta proprias
export interface Cobranca { titulo: string; centavos: number; agendamentoId: string; expiraEm: Date; nome: string; email?: string | null; referencia?: string; volta?: string }

// Checkout Pro: o cliente paga com Pix ou cartao na pagina do Mercado Pago.
export async function criarPreferencia(token: string, c: Cobranca) {
  const volta = c.volta || `${config.siteUrl}/?pagamento=${c.agendamentoId}`;
  const taxa = taxaPlataforma(c.centavos);
  const [nome, ...resto] = c.nome.trim().split(/\s+/);
  const p = await mp<{ id: string; init_point: string }>(token, 'POST', '/checkout/preferences', {
    items: [{ id: c.agendamentoId, title: c.titulo.slice(0, 250), quantity: 1, unit_price: c.centavos / 100, currency_id: 'BRL' }],
    payer: { name: nome, surname: resto.join(' ') || undefined, email: c.email || undefined },
    external_reference: c.referencia || referenciaDe(c.agendamentoId),
    notification_url: `${config.siteUrl}/api/webhook/mercado-pago`,
    back_urls: { success: volta, pending: volta, failure: volta },
    auto_return: 'approved',
    expires: true,
    expiration_date_from: dataMp(new Date(Date.now() - 60 * 1000)),
    expiration_date_to: dataMp(c.expiraEm),
    date_of_expiration: dataMp(c.expiraEm), // vale para o Pix
    // boleto e lotérica demoram dias para compensar: o horario nao fica preso esperando
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
    statement_descriptor: 'CIDADE NOBRE',
    ...(taxa > 0 ? { marketplace_fee: taxa } : {}),
  });
  return { preferenciaId: p.id, link: p.init_point };
}

export interface PagamentoMp { id: number; status: string; external_reference: string | null; transaction_amount: number; date_approved: string | null; payer?: { first_name?: string | null; last_name?: string | null } | null }

export const buscarPagamento = (token: string, id: string) => mp<PagamentoMp>(token, 'GET', `/v1/payments/${encodeURIComponent(id)}`);

export async function pagamentosDaReferencia(token: string, referencia: string) {
  const r = await mp<{ results: PagamentoMp[] }>(token, 'GET', `/v1/payments/search?external_reference=${encodeURIComponent(referencia)}&sort=date_created&criteria=desc&limit=20`);
  return r.results || [];
}
