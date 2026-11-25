import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { carimbo, hoje } from '../lib/datas';
import { reais } from '../lib/base';
import { removerFoto, trocarFoto } from '../lib/storage';

/*
 * Estoque dos produtos vendidos no balcao (pomada, shampoo, oleo de barba...), no mesmo
 * modelo do Doutor do Celular: o saldo so muda junto com uma movimentacao (entrada, venda ou
 * ajuste de contagem) e nunca fica negativo. Venda de produto nao entra no faturamento dos
 * atendimentos; aparece no proprio Estoque.
 */

type Tx = Prisma.TransactionClient;
type ProdutoRow = Prisma.ProdutoGetPayload<object>;

const situacao = (p: { quantidade: number; estoqueMinimo: number }) => (p.quantidade === 0 ? 'esgotado' : p.quantidade <= p.estoqueMinimo ? 'baixo' : 'ok');

export const produtoView = (p: ProdutoRow) => ({
  id: p.id, name: p.nome, desc: p.descricao, price: reais(p.precoCentavos), cost: reais(p.custoCentavos),
  qty: p.quantidade, min: p.estoqueMinimo, photo: p.foto, status: situacao(p),
  shelf: p.vitrine, cat: p.categoria,
});

const centavos = (v: number) => Math.round(v * 100);

/* ============ leitura da tela ============ */
export async function painelEstoque() {
  const desde = new Date(Date.now() - 30 * 86400000);
  const [produtos, vendas, movs] = await Promise.all([
    prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.movimentoEstoque.findMany({ where: { tipo: 'venda', criadoEm: { gte: desde } }, select: { quantidade: true, valorCentavos: true } }),
    prisma.movimentoEstoque.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 60,
      include: { produto: { select: { nome: true } }, usuario: { select: { nome: true } } },
    }),
  ]);
  return {
    today: hoje(),
    products: produtos.map(produtoView),
    kpis: {
      products: produtos.length,
      units: produtos.reduce((t, p) => t + p.quantidade, 0),
      stockValue: reais(produtos.reduce((t, p) => t + p.quantidade * p.precoCentavos, 0)),
      stockCost: reais(produtos.reduce((t, p) => t + p.quantidade * p.custoCentavos, 0)),
      low: produtos.filter((p) => situacao(p) === 'baixo').length,
      out: produtos.filter((p) => situacao(p) === 'esgotado').length,
      sold30: vendas.reduce((t, v) => t - v.quantidade, 0),
      revenue30: reais(vendas.reduce((t, v) => t + (v.valorCentavos || 0), 0)),
    },
    moves: movs.map((m) => ({
      id: m.id, at: carimbo(m.criadoEm), type: m.tipo, qty: m.quantidade, balance: m.saldoApos,
      value: m.valorCentavos === null ? null : reais(m.valorCentavos), reason: m.motivo,
      productId: m.produtoId, product: m.produto.nome, user: m.usuario?.nome || null,
    })),
  };
}

// Para o menu da gestao: quantos produtos pedem reposicao.
export async function produtosParaRepor() {
  const ps = await prisma.produto.findMany({ where: { ativo: true }, select: { quantidade: true, estoqueMinimo: true } });
  return ps.filter((p) => p.quantidade <= p.estoqueMinimo).length;
}

/* ============ cadastro (gerente) ============ */
const produtoSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do produto.').max(80),
  desc: z.string().trim().max(160).default(''),
  price: z.number().min(0, 'Use preço entre R$ 0 e R$ 10.000.').max(10000, 'Use preço entre R$ 0 e R$ 10.000.'),
  cost: z.number().min(0, 'Use custo entre R$ 0 e R$ 10.000.').max(10000, 'Use custo entre R$ 0 e R$ 10.000.').default(0),
  min: z.number().int().min(0, 'O aviso de estoque baixo vai de 0 a 999.').max(999, 'O aviso de estoque baixo vai de 0 a 999.').default(3),
  shelf: z.enum(['casa', 'celular', 'barbearia']).default('casa'),
  cat: z.string().trim().max(40, 'Use uma categoria de até 40 letras.').default(''),
});

export async function criarProduto(body: unknown, usuarioId: string) {
  const d = produtoSchema
    .extend({ qty: z.number().int().min(0, 'A quantidade inicial não pode ser negativa.').max(99999).default(0) })
    .parse(body);
  return prisma.$transaction(async (tx) => {
    const p = await tx.produto.create({
      data: { nome: d.name, descricao: d.desc, precoCentavos: centavos(d.price), custoCentavos: centavos(d.cost), estoqueMinimo: d.min, quantidade: d.qty, vitrine: d.shelf, categoria: d.cat },
    });
    if (d.qty > 0) {
      await tx.movimentoEstoque.create({ data: { produtoId: p.id, tipo: 'entrada', quantidade: d.qty, saldoApos: d.qty, motivo: 'Estoque inicial', usuarioId } });
    }
    return produtoView(p);
  });
}

export async function atualizarProduto(id: string, body: unknown) {
  const d = produtoSchema.partial().parse(body);
  await produtoAtivo(id);
  const p = await prisma.produto.update({
    where: { id },
    data: {
      nome: d.name, descricao: d.desc, estoqueMinimo: d.min, vitrine: d.shelf, categoria: d.cat,
      precoCentavos: d.price !== undefined ? centavos(d.price) : undefined,
      custoCentavos: d.cost !== undefined ? centavos(d.cost) : undefined,
    },
  });
  return produtoView(p);
}

// Sai da lista, mas as movimentacoes antigas continuam no historico.
export async function removerProduto(id: string) {
  await produtoAtivo(id);
  await prisma.produto.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}

async function produtoAtivo(id: string) {
  const p = await prisma.produto.findUnique({ where: { id } });
  if (!p || !p.ativo) throw falha(404, 'Produto não encontrado.');
  return p;
}

/* ============ entrada, venda e ajuste (qualquer pessoa da equipe) ============ */
const movimentoSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('entrada'), qty: z.number().int().min(1, 'Informe quantas unidades chegaram.').max(9999), reason: z.string().trim().max(200).optional() }),
  z.object({
    type: z.literal('venda'),
    qty: z.number().int().min(1, 'Informe quantas unidades foram vendidas.').max(9999),
    // total recebido; sem valor, usa o preco de venda do produto
    value: z.number().min(0).max(100000).optional(),
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({ type: z.literal('ajuste'), count: z.number().int().min(0, 'A contagem não pode ser negativa.').max(99999), reason: z.string().trim().max(200).optional() }),
]);

// Saldo atual travando a linha ate o fim da transacao: duas vendas ao mesmo tempo nao leem o mesmo saldo.
async function saldoComTrava(tx: Tx, id: string) {
  const linhas = await tx.$queryRaw<{ quantidade: number; ativo: boolean; nome: string; precoCentavos: number }[]>`
    SELECT "quantidade", "ativo", "nome", "precoCentavos" FROM "produtos" WHERE "id" = ${id} FOR UPDATE`;
  const p = linhas[0];
  if (!p || !p.ativo) throw falha(404, 'Produto não encontrado.');
  return { ...p, quantidade: Number(p.quantidade) };
}

export async function movimentar(id: string, body: unknown, usuarioId: string) {
  const d = movimentoSchema.parse(body);
  return prisma.$transaction(async (tx) => {
    const p = await saldoComTrava(tx, id);
    let delta: number, valorCentavos: number | null = null, motivo: string;
    if (d.type === 'entrada') {
      delta = d.qty;
      motivo = d.reason || 'Entrada de mercadoria';
    } else if (d.type === 'venda') {
      if (d.qty > p.quantidade) throw falha(409, `Estoque insuficiente de ${p.nome}: a venda precisa de ${d.qty} e há ${p.quantidade}.`);
      delta = -d.qty;
      valorCentavos = d.value !== undefined ? centavos(d.value) : d.qty * p.precoCentavos;
      motivo = d.reason || 'Venda no balcão';
    } else {
      delta = d.count - p.quantidade;
      if (delta === 0) throw falha(400, `A contagem é igual ao saldo atual (${p.quantidade}). Nada a ajustar.`);
      motivo = d.reason || 'Ajuste de contagem';
    }
    const saldo = p.quantidade + delta;
    const atualizado = await tx.produto.update({ where: { id }, data: { quantidade: saldo } });
    await tx.movimentoEstoque.create({ data: { produtoId: id, tipo: d.type, quantidade: delta, saldoApos: saldo, valorCentavos, motivo, usuarioId } });
    return produtoView(atualizado);
  });
}

/* ============ foto ============ */
type Arquivo = { buffer: Buffer; mimetype: string } | undefined;

export async function enviarFotoProduto(id: string, arquivo: Arquivo) {
  if (!arquivo) throw falha(400, 'Nenhuma imagem enviada.');
  const atual = await produtoAtivo(id);
  const p = await trocarFoto(arquivo, `produto-${id}`, (url) => prisma.produto.update({ where: { id }, data: { foto: url } }));
  await removerFoto(atual.foto);
  return produtoView(p);
}

export async function removerFotoProduto(id: string) {
  const atual = await produtoAtivo(id);
  const p = await prisma.produto.update({ where: { id }, data: { foto: null } });
  await removerFoto(atual.foto);
  return produtoView(p);
}
