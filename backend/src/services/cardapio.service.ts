import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { reais } from '../lib/base';
import { removerFoto, trocarFoto } from '../lib/storage';

// Cardapio de bebidas do site. Categorias fixas porque cada uma tem um desenho proprio na tela.
export const CATEGORIAS = [
  { id: 'drinks', name: 'Drinks' },
  { id: 'cervejas', name: 'Cervejas' },
  { id: 'whisky', name: 'Whisky & Doses' },
  { id: 'sem_alcool', name: 'Sem álcool' },
] as const;
const IDS = CATEGORIAS.map((c) => c.id) as [string, ...string[]];

type Row = { id: string; nome: string; categoria: string; precoCentavos: number; foto: string | null; visivel: boolean; ordem: number };
const view = (i: Row) => ({ id: i.id, name: i.nome, cat: i.categoria, price: reais(i.precoCentavos), photo: i.foto, visible: i.visivel, order: i.ordem });
const ordem = [{ categoria: 'asc' as const }, { ordem: 'asc' as const }, { nome: 'asc' as const }];

export async function cardapioPublico() {
  const [itens, c] = await Promise.all([
    prisma.itemCardapio.findMany({ where: { ativo: true, visivel: true }, orderBy: ordem }),
    prisma.configuracao.findUnique({ where: { id: 1 }, select: { mercadoPagoAccessToken: true } }),
  ]);
  // payOnline: o pedido do site e pago na hora pelo Mercado Pago
  return { categories: CATEGORIAS, items: itens.map(view), payOnline: !!c?.mercadoPagoAccessToken };
}

export async function cardapioGestao() {
  const itens = await prisma.itemCardapio.findMany({ where: { ativo: true }, orderBy: ordem });
  return { categories: CATEGORIAS, items: itens.map(view) };
}

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(60),
  cat: z.enum(IDS, { errorMap: () => ({ message: 'Escolha a categoria.' }) }),
  price: z.number().min(0, 'Use preço entre R$ 0 e R$ 10.000.').max(10000, 'Use preço entre R$ 0 e R$ 10.000.'),
  visible: z.boolean().default(true),
});

async function ativo(id: string) {
  const i = await prisma.itemCardapio.findUnique({ where: { id } });
  if (!i || !i.ativo) throw falha(404, 'Item do cardápio não encontrado.');
  return i;
}

export async function criarItem(body: unknown) {
  const d = schema.parse(body);
  const ult = await prisma.itemCardapio.aggregate({ where: { categoria: d.cat, ativo: true }, _max: { ordem: true } });
  const i = await prisma.itemCardapio.create({
    data: { nome: d.name, categoria: d.cat, precoCentavos: Math.round(d.price * 100), visivel: d.visible, ordem: (ult._max.ordem || 0) + 1 },
  });
  return view(i);
}

export async function atualizarItem(id: string, body: unknown) {
  const d = schema.partial().parse(body);
  const atual = await ativo(id);
  const mudouCat = d.cat && d.cat !== atual.categoria;
  const ult = mudouCat ? await prisma.itemCardapio.aggregate({ where: { categoria: d.cat, ativo: true }, _max: { ordem: true } }) : null;
  const i = await prisma.itemCardapio.update({
    where: { id },
    data: {
      nome: d.name, categoria: d.cat, visivel: d.visible,
      precoCentavos: d.price !== undefined ? Math.round(d.price * 100) : undefined,
      ordem: ult ? (ult._max.ordem || 0) + 1 : undefined,
    },
  });
  return view(i);
}

export async function removerItem(id: string) {
  const atual = await ativo(id);
  await prisma.itemCardapio.update({ where: { id }, data: { ativo: false } });
  await removerFoto(atual.foto);
  return { ok: true };
}

// sobe ou desce uma posicao dentro da categoria
export async function moverItem(id: string, body: unknown) {
  const { dir } = z.object({ dir: z.enum(['up', 'down']) }).parse(body);
  const atual = await ativo(id);
  const lista = await prisma.itemCardapio.findMany({ where: { ativo: true, categoria: atual.categoria }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] });
  const k = lista.findIndex((x) => x.id === id);
  const j = dir === 'up' ? k - 1 : k + 1;
  if (j < 0 || j >= lista.length) return cardapioGestao();
  [lista[k], lista[j]] = [lista[j], lista[k]];
  await prisma.$transaction(lista.map((x, n) => prisma.itemCardapio.update({ where: { id: x.id }, data: { ordem: n + 1 } })));
  return cardapioGestao();
}

type Arquivo = { buffer: Buffer; mimetype: string } | undefined;
export async function enviarFoto(id: string, arquivo: Arquivo) {
  if (!arquivo) throw falha(400, 'Nenhuma imagem enviada.');
  const atual = await ativo(id);
  const i = await trocarFoto(arquivo, `cardapio-${id}`, (url) => prisma.itemCardapio.update({ where: { id }, data: { foto: url } }));
  await removerFoto(atual.foto);
  return view(i);
}

export async function tirarFoto(id: string) {
  const atual = await ativo(id);
  const i = await prisma.itemCardapio.update({ where: { id }, data: { foto: null } });
  await removerFoto(atual.foto);
  return view(i);
}
