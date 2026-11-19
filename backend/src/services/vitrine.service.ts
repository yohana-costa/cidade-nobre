import { prisma } from '../lib/prisma';
import { reais } from '../lib/base';
import { config } from '../config/env';

// Vitrine do inicio do site: acessorios da loja do Doutor do Celular (Kauan Cell) e os
// produtos do estoque da propria barbearia. O catalogo do Doutor vem da API publica dele,
// guardado por 5 minutos; se a loja estiver fora do ar, a vitrine some sem derrubar o site.

type DoutorProduto = {
  id: string; name: string; group: string; sub: string; price: number; rank?: number; isNew?: boolean;
  active: boolean; image?: string | null; variations?: { price: number; active: boolean }[];
};
type DoutorCatalogo = { subs: { id: string; label: string; order: number }[]; products: DoutorProduto[]; stock: Record<string, number> };

export type ItemCelular = { id: string; name: string; price: number; from: boolean; image: string; sub: string; url: string };
type VitrineCelular = { url: string; logo: string; subs: { id: string; label: string }[]; items: ItemCelular[] };

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; data: VitrineCelular } | null = null;

const absoluta = (u: string) => (/^https?:\/\//.test(u) ? u : config.doutorUrl + (u.startsWith('/') ? '' : '/') + u);

// so acessorios com foto e com saldo em alguma unidade (chave do estoque: produto|opcoes|unidade)
export function montarVitrineCelular(c: DoutorCatalogo, base = config.doutorUrl): VitrineCelular {
  const saldo: Record<string, number> = {};
  for (const [k, q] of Object.entries(c.stock || {})) {
    const id = k.split('|')[0];
    saldo[id] = (saldo[id] || 0) + (Number(q) || 0);
  }
  const ok = (c.products || [])
    .filter((p) => p.active && p.group === 'acessorios' && p.image && (saldo[p.id] || 0) > 0)
    .sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew) || (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name));
  // intercala as categorias (um carregador, um fone, um power bank...) para o "Todos" ficar variado
  const filas = new Map<string, DoutorProduto[]>();
  for (const p of ok) filas.set(p.sub, [...(filas.get(p.sub) || []), p]);
  const misturados: DoutorProduto[] = [];
  while (misturados.length < ok.length) for (const f of filas.values()) { const p = f.shift(); if (p) misturados.push(p); }
  const items = misturados
    .slice(0, 60)
    .map((p) => {
      const precos = (p.variations || []).filter((v) => v.active).map((v) => v.price);
      const menor = precos.length ? Math.min(...precos) : p.price;
      return { id: p.id, name: p.name, price: menor, from: precos.some((v) => v !== menor), image: absoluta(p.image!), sub: p.sub, url: `${base}/#produto-${encodeURIComponent(p.id)}` };
    });
  const usadas = new Set(items.map((i) => i.sub));
  const subs = (c.subs || []).filter((s) => usadas.has(s.id)).sort((a, b) => a.order - b.order).map((s) => ({ id: s.id, label: s.label }));
  return { url: `${base}/#loja-acessorios`, logo: `${base}/assets/img/logo-kauan-cell.png`, subs, items };
}

async function vitrineCelular(): Promise<VitrineCelular | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const r = await fetch(`${config.doutorUrl}/api/loja/catalogo`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = montarVitrineCelular((await r.json()) as DoutorCatalogo);
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.warn('[vitrine] catalogo do Doutor indisponivel:', (e as Error).message);
    // usa a ultima vitrine boa e tenta de novo em 1 minuto
    if (cache) { cache.at = Date.now() - CACHE_MS + 60000; return cache.data; }
    return null;
  }
}

export async function vitrine() {
  const [celular, produtos] = await Promise.all([
    vitrineCelular(),
    prisma.produto.findMany({ where: { ativo: true, quantidade: { gt: 0 } }, orderBy: { nome: 'asc' }, take: 30 }),
  ]);
  return {
    celular,
    barbearia: produtos.map((p) => ({ id: p.id, name: p.nome, desc: p.descricao, price: reais(p.precoCentavos), photo: p.foto })),
  };
}
