import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { reais } from '../lib/base';

// Pedido do site: bebidas do cardapio e produtos da vitrine. O preco vem sempre do cadastro (nunca do navegador)
// e o pagamento e feito na barbearia. A equipe acompanha e muda o status na gestao.
export const STATUS = ['novo', 'preparando', 'entregue', 'cancelado'] as const;
type Item = { id: string; name: string; price: number; qty: number };
type Row = { id: string; numero: number; nome: string; profissionalId: string | null; observacao: string; itens: unknown; totalCentavos: number; status: string; criadoEm: Date; atualizadoEm: Date };

const view = (p: Row, pros?: Map<string, string>) => ({
  id: p.id, number: p.numero, name: p.nome, note: p.observacao, items: p.itens as Item[], total: reais(p.totalCentavos),
  status: p.status, proId: p.profissionalId, pro: p.profissionalId ? pros?.get(p.profissionalId) || null : null,
  at: p.criadoEm.toISOString(), updatedAt: p.atualizadoEm.toISOString(),
});

// freio contra envio em massa (robo). Atras do Traefik + nginx o IP pode ser o mesmo para todos,
// entao o limite e folgado: 40 pedidos a cada 10 minutos por endereco.
const janela = new Map<string, number[]>();
function frear(ip: string) {
  const agora = Date.now();
  const lista = (janela.get(ip) || []).filter((t) => agora - t < 10 * 60000);
  if (lista.length >= 40) throw falha(429, 'Muitos pedidos seguidos. Chame a equipe da barbearia.');
  lista.push(agora);
  janela.set(ip, lista);
  if (janela.size > 5000) janela.clear();
}

const novoSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome para a equipe saber de quem é o pedido.').max(60),
  proId: z.string().max(60).optional().nullable(),
  note: z.string().trim().max(140, 'Use até 140 letras na observação.').default(''),
  items: z.array(z.object({ id: z.string().max(80), qty: z.number().int().min(1).max(20) })).min(1, 'Seu pedido está vazio.').max(30),
});

export async function criarPedido(body: unknown, ip: string, clienteId: string | null) {
  const d = novoSchema.parse(body);
  const ids = [...new Set(d.items.map((i) => i.id))];
  // bebida do cardapio ou produto da vitrine (Kauan Cell / produtos da barbearia)
  const [cadastro, produtos] = await Promise.all([
    prisma.itemCardapio.findMany({ where: { id: { in: ids }, ativo: true, visivel: true } }),
    prisma.produto.findMany({ where: { id: { in: ids }, ativo: true, vitrine: { in: ['celular', 'barbearia'] }, precoCentavos: { gt: 0 } } }),
  ]);
  const porId = new Map<string, { nome: string; precoCentavos: number; saldo: number | null }>();
  for (const c of cadastro) porId.set(c.id, { nome: c.nome, precoCentavos: c.precoCentavos, saldo: null });
  for (const p of produtos) porId.set(p.id, { nome: p.nome, precoCentavos: p.precoCentavos, saldo: p.quantidade });
  const qtd = new Map<string, number>();
  for (const i of d.items) qtd.set(i.id, Math.min(20, (qtd.get(i.id) || 0) + i.qty));
  const itens: Item[] = [];
  for (const [id, q] of qtd) {
    const c = porId.get(id);
    if (!c || c.saldo === 0) throw falha(409, 'Um item do seu pedido não está mais disponível. Confira o pedido e envie de novo.');
    if (c.saldo !== null && q > c.saldo) throw falha(409, `Temos só ${c.saldo} de ${c.nome} agora. Diminua a quantidade e envie de novo.`);
    itens.push({ id, name: c.nome, price: reais(c.precoCentavos), qty: q });
  }
  let proId: string | null = null;
  if (d.proId) {
    const pro = await prisma.profissional.findFirst({ where: { id: d.proId, ativo: true }, select: { id: true } });
    proId = pro ? pro.id : null;
  }
  frear(ip);
  const total = [...qtd].reduce((s, [id, q]) => s + porId.get(id)!.precoCentavos * q, 0);
  const p = await prisma.pedidoBar.create({ data: { nome: d.name, profissionalId: proId, observacao: d.note, itens, totalCentavos: total, clienteId } });
  return view(p);
}

// o id do pedido (uuid) so quem pediu tem
export async function verPedido(id: string) {
  const p = await prisma.pedidoBar.findUnique({ where: { id } });
  if (!p) throw falha(404, 'Pedido não encontrado.');
  return view(p);
}

async function nomesPros() {
  const pros = await prisma.profissional.findMany({ select: { id: true, nome: true } });
  return new Map(pros.map((p) => [p.id, p.nome]));
}

// abertos + os fechados das ultimas 12 horas
export async function listaGestao() {
  const desde = new Date(Date.now() - 12 * 3600000);
  const [lista, pros] = await Promise.all([
    prisma.pedidoBar.findMany({
      where: { OR: [{ status: { in: ['novo', 'preparando'] } }, { atualizadoEm: { gte: desde } }] },
      orderBy: { criadoEm: 'desc' }, take: 200,
    }),
    nomesPros(),
  ]);
  return { orders: lista.map((p) => view(p, pros)) };
}

export async function mudarStatus(id: string, body: unknown) {
  const { status } = z.object({ status: z.enum(STATUS) }).parse(body);
  const p = await prisma.pedidoBar.findUnique({ where: { id } });
  if (!p) throw falha(404, 'Pedido não encontrado.');
  const n = await prisma.pedidoBar.update({ where: { id }, data: { status } });
  return view(n, await nomesPros());
}

export const pedidosAbertos = () => prisma.pedidoBar.count({ where: { status: { in: ['novo', 'preparando'] } } });
