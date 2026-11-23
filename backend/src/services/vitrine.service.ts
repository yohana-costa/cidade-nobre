import { prisma } from '../lib/prisma';
import { reais } from '../lib/base';

// Vitrine do inicio do site, toda do estoque da propria barbearia (cadastrado em Gestao > Estoque):
// - "Acessorios para celular": produtos marcados como celular, filtrados pela categoria;
// - "Produtos da casa": o resto (pomada, shampoo...).
// So entra produto ativo e com saldo; quando acaba, sai do site sozinho.
const ordemCat = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

export async function vitrine() {
  const produtos = await prisma.produto.findMany({
    where: { ativo: true, quantidade: { gt: 0 } },
    orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
  });
  const item = (p: (typeof produtos)[number]) => ({ id: p.id, name: p.nome, desc: p.descricao, price: reais(p.precoCentavos), photo: p.foto, cat: p.categoria });
  const cel = produtos.filter((p) => p.vitrine === 'celular');

  // intercala as categorias (uma capinha, um carregador...) para o "Todos" ficar variado
  const filas = new Map<string, typeof cel>();
  for (const p of cel) filas.set(p.categoria, [...(filas.get(p.categoria) || []), p]);
  const misturados: typeof cel = [];
  while (misturados.length < cel.length) for (const f of filas.values()) { const p = f.shift(); if (p) misturados.push(p); }

  const cats = [...new Set(cel.map((p) => p.categoria).filter(Boolean))].sort(ordemCat);
  return {
    celular: { cats, items: misturados.map(item) },
    barbearia: produtos.filter((p) => p.vitrine !== 'celular').map(item),
  };
}
