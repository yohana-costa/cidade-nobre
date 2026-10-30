import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { signCliente } from '../lib/jwt';
import { hoje, diffDays, agoraMin } from '../lib/datas';
import {
  apptInclude, apptView, clientView, moveView, refView, voucherView, club, paid, isOpenStatus, shortName, ApptV,
} from '../lib/base';
import { obterConfiguracao } from './configuracao.service';

type Tx = Prisma.TransactionClient;

// Codigo do link de indicacao: CN + 5 caracteres sem letras ambiguas (0/O, 1/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function gerarCodigoCliente(tx: Tx | typeof prisma) {
  for (let i = 0; i < 20; i++) {
    let c = 'CN';
    for (let k = 0; k < 5; k++) c += ALFABETO[randomInt(ALFABETO.length)];
    if (!(await tx.cliente.findUnique({ where: { codigo: c } }))) return c;
  }
  throw falha(500, 'Não foi possível gerar o código de indicação.');
}

const onlyDigits = (s: string) => String(s || '').replace(/\D/g, '');
const telefone = z
  .string({ required_error: 'Informe o telefone.' })
  .transform(onlyDigits)
  .refine((d) => d.length >= 10 && d.length <= 11, 'O telefone precisa ter DDD + número (10 ou 11 dígitos).');
const senha = z.string({ required_error: 'Informe a senha.' }).min(6, 'A senha precisa ter pelo menos 6 caracteres.').max(72);

/* ============ conta do cliente (telefone + senha) ============ */
export async function entrar(body: unknown) {
  const d = z.object({ phone: telefone, password: z.string().min(1, 'Informe a senha.') }).parse(body);
  const c = await prisma.cliente.findUnique({ where: { telefone: d.phone } });
  // mesma mensagem para telefone inexistente e senha errada: nao revela quem e cliente
  if (!c || !c.senha || !(await bcrypt.compare(d.password, c.senha))) throw falha(401, 'Telefone ou senha incorretos.');
  return { token: signCliente(c.id) };
}

// Primeiro acesso de quem ja era cliente (cadastrado no balcao ou que agendou sem senha):
// a equipe gera um codigo de 6 digitos na gestao e entrega ao cliente.
export async function primeiroAcesso(body: unknown) {
  const d = z.object({ phone: telefone, code: z.string().trim().regex(/^\d{6}$/, 'O código tem 6 dígitos.'), password: senha }).parse(body);
  const c = await prisma.cliente.findUnique({ where: { telefone: d.phone } });
  const valido = c && c.codigoAcesso && c.codigoAcessoExpira && c.codigoAcessoExpira > new Date() && (await bcrypt.compare(d.code, c.codigoAcesso));
  if (!c || !valido) throw falha(401, 'Código inválido ou expirado. Peça um novo código na barbearia.');
  await prisma.cliente.update({ where: { id: c.id }, data: { senha: await bcrypt.hash(d.password, 10), codigoAcesso: null, codigoAcessoExpira: null } });
  return { token: signCliente(c.id) };
}

export async function gerarCodigoAcesso(clienteId: string) {
  const c = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!c) throw falha(404, 'Cliente não encontrado.');
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expira = new Date(Date.now() + 48 * 3600 * 1000);
  await prisma.cliente.update({ where: { id: c.id }, data: { codigoAcesso: await bcrypt.hash(codigo, 10), codigoAcessoExpira: expira } });
  return { code: codigo, expiresAt: expira.toISOString(), hasAccount: !!c.senha };
}

export async function alterarSenhaCliente(clienteId: string, body: unknown) {
  const d = z.object({ currentPassword: z.string().min(1, 'Informe a senha atual.'), newPassword: senha }).parse(body);
  const c = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
  if (!c.senha || !(await bcrypt.compare(d.currentPassword, c.senha))) throw falha(401, 'Senha atual incorreta.');
  await prisma.cliente.update({ where: { id: c.id }, data: { senha: await bcrypt.hash(d.newPassword, 10) } });
  return { ok: true };
}

const dadosSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome com pelo menos 3 letras.').max(80),
  phone: telefone,
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Confira o e-mail ou deixe o campo em branco.')
    .default(''),
});

export async function atualizarDados(clienteId: string, body: unknown) {
  const d = dadosSchema.parse(body);
  const outro = await prisma.cliente.findUnique({ where: { telefone: d.phone } });
  if (outro && outro.id !== clienteId) throw falha(409, 'Este telefone já pertence a outro cadastro.');
  await prisma.cliente.update({ where: { id: clienteId }, data: { nome: d.name, telefone: d.phone, email: d.email || null } });
  return { ok: true };
}

/* ============ visao completa de um cliente (usada pelo proprio cliente e pela equipe) ============ */
export async function visaoCliente(clienteId: string) {
  const cfg = await obterConfiguracao();
  const T = hoje();
  const c = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      indicacaoRecebida: { include: { indicador: { select: { id: true, nome: true } } } },
      indicacoesFeitas: { include: { indicado: { select: { id: true, nome: true } } }, orderBy: { criadoEm: 'desc' } },
      agendamentos: { include: apptInclude, orderBy: [{ data: 'asc' }, { hora: 'asc' }] },
      movimentos: { orderBy: { criadoEm: 'desc' } },
      vouchers: { orderBy: { criadoEm: 'desc' } },
    },
  });
  if (!c) throw falha(404, 'Cliente não encontrado.');
  const appts: ApptV[] = c.agendamentos.map(apptView);
  const pros = await prisma.profissional.findMany({ select: { id: true, nome: true } });
  const proNames = Object.fromEntries(pros.map((p) => [p.id, p.nome]));
  const done = appts.filter((a) => a.status === 'concluido');
  const last = done[done.length - 1] || null;
  const next = appts.find((a) => isOpenStatus(a) && a.date >= T) || null;
  const bal = c.movimentos.reduce((t, m) => t + m.pontos, 0);
  // nomes curtos dos indicados (o cliente ve so o primeiro nome + inicial)
  const refNames: Record<string, string> = {};
  for (const r of c.indicacoesFeitas) refNames[r.indicadoId] = r.indicado.nome;
  if (c.indicacaoRecebida) refNames[c.indicacaoRecebida.indicadorId] = c.indicacaoRecebida.indicador.nome;
  return {
    today: T,
    nowMin: agoraMin(),
    client: clientView(c),
    stats: { visits: done.length, spent: done.reduce((t, a) => t + paid(a), 0), last, next, points: bal, sinceLast: last ? diffDays(T, last.date) : null },
    club: club(cfg, bal),
    appts,
    moves: c.movimentos.map(moveView),
    vouchers: c.vouchers.map(voucherView),
    referralsGiven: c.indicacoesFeitas.map(refView),
    referralGot: c.indicacaoRecebida ? refView(c.indicacaoRecebida) : null,
    names: refNames,
    proNames,
  };
}

// O cliente ve apenas o primeiro nome + inicial de quem ele indicou.
export async function minhaConta(clienteId: string) {
  const v = await visaoCliente(clienteId);
  const names: Record<string, string> = {};
  for (const [id, n] of Object.entries(v.names)) names[id] = shortName(n);
  return { ...v, names };
}

/* ============ resgate (antes redeem() em core.js) ============ */
export async function resgatar(clienteId: string) {
  const cfg = await obterConfiguracao();
  return prisma.$transaction(async (tx) => {
    // trava por cliente: dois cliques em "Confirmar resgate" nao gastam o saldo duas vezes
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'resgate:' + clienteId}))`;
    const s = await tx.movimentoPontos.aggregate({ where: { clienteId }, _sum: { pontos: true } });
    const saldo = s._sum.pontos || 0;
    if (saldo < cfg.redeemPoints) throw falha(400, 'Saldo insuficiente para o resgate.');
    const v = await tx.voucher.create({
      data: { clienteId, titulo: cfg.benefitTitle, valorCentavos: cfg.redeemValueCents, custoPontos: cfg.redeemPoints },
    });
    await tx.movimentoPontos.create({ data: { clienteId, tipo: 'resgate', pontos: -cfg.redeemPoints, voucherId: v.id } });
    return { voucher: voucherView(v), balance: saldo - cfg.redeemPoints };
  });
}

/* ============ equipe: dados do cliente ============ */
export async function atualizarClienteEquipe(clienteId: string, body: unknown) {
  const c = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!c) throw falha(404, 'Cliente não encontrado.');
  return atualizarDados(clienteId, body);
}

export async function buscarCliente(q: string) {
  const t = String(q || '').trim();
  if (t.length < 2) return [];
  const dig = onlyDigits(t);
  const rows = await prisma.cliente.findMany({
    where: { OR: [{ nome: { contains: t, mode: 'insensitive' } }, ...(dig.length >= 3 ? [{ telefone: { contains: dig } }] : [])] },
    take: 8,
    orderBy: { nome: 'asc' },
    include: { indicacaoRecebida: true },
  });
  return rows.map(clientView);
}
