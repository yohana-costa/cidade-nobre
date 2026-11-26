import { prisma } from '../lib/prisma';
import { reais } from '../lib/base';

// Vitrine do site, do estoque da propria barbearia (Gestao > Estoque, campo "No site"):
// - celular: acessorios Kauan Cell (capinhas, carregadores...);
// - barbearia: produtos da barbearia (pomadas, oleos, shampoos...).
// O resto (bebidas etc.) fica so no balcao. A categoria vira o filtro.
// So entra produto ativo e com saldo; quando acaba, sai do site sozinho.
const ordemCat = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
type Prod = Awaited<ReturnType<typeof prisma.produto.findMany>>[number];

function prateleira(lista: Prod[]) {
  const item = (p: Prod) => ({ id: p.id, name: p.nome, desc: p.descricao, price: reais(p.precoCentavos), photo: p.foto, cat: p.categoria, stock: Math.min(p.quantidade, 20) });
  // intercala as categorias (uma capinha, um carregador...) para o "Todos" ficar variado
  const filas = new Map<string, Prod[]>();
  for (const p of lista) filas.set(p.categoria, [...(filas.get(p.categoria) || []), p]);
  const misturados: Prod[] = [];
  while (misturados.length < lista.length) for (const f of filas.values()) { const p = f.shift(); if (p) misturados.push(p); }
  const cats = [...new Set(lista.map((p) => p.categoria).filter(Boolean))].sort(ordemCat);
  return { cats, items: misturados.map(item) };
}

export async function vitrine() {
  const conf = await prisma.configuracao.findUnique({ where: { id: 1 }, select: { mercadoPagoAccessToken: true } });
  const produtos = await prisma.produto.findMany({
    where: { ativo: true, quantidade: { gt: 0 }, vitrine: { in: ['celular', 'barbearia'] } },
    orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
  });
  return {
    celular: prateleira(produtos.filter((p) => p.vitrine === 'celular')),
    barbearia: prateleira(produtos.filter((p) => p.vitrine === 'barbearia')),
    payOnline: !!conf?.mercadoPagoAccessToken, // pedido pago na hora pelo Mercado Pago
  };
}
