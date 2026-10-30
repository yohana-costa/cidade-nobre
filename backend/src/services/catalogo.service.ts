import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { hoje } from '../lib/datas';
import { reais } from '../lib/base';
import { obterConfiguracao } from './configuracao.service';

// Imagens disponiveis em assets/ para ilustrar um servico no site
export const IMAGENS_SERVICO = ['svc_corte', 'svc_barba', 'svc_penteado', 'svc_manicure', 'svc_nasal', 'svc_sobrancelha', 'cat_cabelo', 'cat_barba', 'cat_cuidados'];

type ServicoRow = { id: string; nome: string; descricao: string; categoriaId: string; duracaoMin: number; precoCentavos: number; imagem: string | null; visivel: boolean; ativo: boolean; ordem: number };
export const serviceView = (s: ServicoRow) => ({
  id: s.id, name: s.nome, desc: s.descricao, cat: s.categoriaId, dur: s.duracaoMin, price: reais(s.precoCentavos),
  img: s.imagem || `cat_${s.categoriaId}`, visible: s.visivel, active: s.ativo, order: s.ordem,
});

// Catalogo publico: o que o site precisa para montar Servicos e Agendamento.
export async function catalogoPublico() {
  const [cfg, categorias, servicos, pros] = await Promise.all([
    obterConfiguracao(),
    prisma.categoria.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.servico.findMany({ where: { ativo: true, visivel: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] }),
    prisma.profissional.findMany({ where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }], include: { servicos: { where: { ativo: true }, select: { id: true } } } }),
  ]);
  return {
    today: hoje(),
    settings: cfg,
    categories: categorias.map((c) => ({ id: c.id, name: c.nome })),
    services: servicos.map(serviceView),
    pros: pros.map((p) => ({ id: p.id, name: p.nome, services: p.servicos.map((s) => s.id) })),
  };
}

/* ============ gestao: servicos ============ */
const servicoSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do serviço.').max(80),
  desc: z.string().trim().max(160).default(''),
  cat: z.string().min(1, 'Escolha a categoria.'),
  dur: z.number().int().min(5, 'Use duração entre 5 e 240 min.').max(240, 'Use duração entre 5 e 240 min.'),
  price: z.number().min(0, 'Use preço entre R$ 0 e R$ 2.000.').max(2000, 'Use preço entre R$ 0 e R$ 2.000.'),
  img: z.string().nullable().optional(),
  visible: z.boolean().default(true),
  order: z.number().int().min(0).max(999).optional(),
  proIds: z.array(z.string()).optional(),
});

async function validarCategoria(cat: string) {
  const c = await prisma.categoria.findUnique({ where: { id: cat } });
  if (!c) throw falha(400, 'Categoria inválida.');
}

function imagemValida(img: string | null | undefined) {
  if (img && !IMAGENS_SERVICO.includes(img)) throw falha(400, 'Imagem inválida.');
  return img || null;
}

async function garantirUmVisivel(excetoId?: string) {
  const n = await prisma.servico.count({ where: { ativo: true, visivel: true, ...(excetoId ? { id: { not: excetoId } } : {}) } });
  if (n === 0) throw falha(400, 'Mantenha ao menos um serviço visível no site.');
}

export async function criarServico(body: unknown) {
  const d = servicoSchema.parse(body);
  await validarCategoria(d.cat);
  const data = {
    nome: d.name, descricao: d.desc, categoriaId: d.cat, duracaoMin: d.dur, precoCentavos: Math.round(d.price * 100),
    imagem: imagemValida(d.img), visivel: d.visible, ordem: d.order ?? 0, ativo: true,
    ...(d.proIds ? { profissionais: { set: d.proIds.map((id) => ({ id })) } } : {}),
  };
  const existente = await prisma.servico.findUnique({ where: { nome: d.name } });
  if (existente?.ativo) throw falha(409, 'Já existe um serviço com esse nome.');
  // nome de um servico removido antes: reaproveita o registro (o historico continua ligado a ele)
  const s = existente
    ? await prisma.servico.update({ where: { id: existente.id }, data })
    : await prisma.servico.create({ data: { ...data, profissionais: d.proIds ? { connect: d.proIds.map((id) => ({ id })) } : undefined } });
  return serviceView(s);
}

export async function atualizarServico(id: string, body: unknown) {
  const d = servicoSchema.partial().parse(body);
  const atual = await prisma.servico.findUnique({ where: { id } });
  if (!atual || !atual.ativo) throw falha(404, 'Serviço não encontrado.');
  if (d.cat) await validarCategoria(d.cat);
  if (d.name && d.name !== atual.nome) {
    const outro = await prisma.servico.findUnique({ where: { nome: d.name } });
    if (outro) throw falha(409, 'Já existe um serviço com esse nome.');
  }
  if (d.visible === false && atual.visivel) await garantirUmVisivel(id);
  const s = await prisma.servico.update({
    where: { id },
    data: {
      nome: d.name, descricao: d.desc, categoriaId: d.cat, duracaoMin: d.dur,
      precoCentavos: d.price !== undefined ? Math.round(d.price * 100) : undefined,
      imagem: d.img !== undefined ? imagemValida(d.img) : undefined, visivel: d.visible, ordem: d.order,
      ...(d.proIds ? { profissionais: { set: d.proIds.map((pid) => ({ id: pid })) } } : {}),
    },
  });
  return serviceView(s);
}

// Remover nao apaga: o servico sai do catalogo e da equipe, mas os atendimentos antigos
// continuam com o nome e o preco congelados no momento da reserva.
export async function removerServico(id: string) {
  const atual = await prisma.servico.findUnique({ where: { id } });
  if (!atual || !atual.ativo) throw falha(404, 'Serviço não encontrado.');
  if (atual.visivel) await garantirUmVisivel(id);
  await prisma.servico.update({ where: { id }, data: { ativo: false, visivel: false, profissionais: { set: [] } } });
  return { ok: true };
}

/* ============ gestao: profissionais ============ */
const proSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do profissional.').max(60),
  services: z.array(z.string()).optional(),
  order: z.number().int().min(0).max(999).optional(),
});

async function validarServicos(ids: string[]) {
  if (!ids.length) throw falha(400, 'Cada profissional precisa realizar ao menos um serviço.');
  const n = await prisma.servico.count({ where: { id: { in: ids }, ativo: true } });
  if (n !== new Set(ids).size) throw falha(400, 'Serviço inválido na lista do profissional.');
}

const proView = (p: { id: string; nome: string; ordem: number; servicos: { id: string }[] }) => ({ id: p.id, name: p.nome, order: p.ordem, services: p.servicos.map((s) => s.id) });

export async function criarProfissional(body: unknown) {
  const d = proSchema.parse(body);
  const ids = d.services ?? [];
  await validarServicos(ids);
  const existente = await prisma.profissional.findUnique({ where: { nome: d.name } });
  if (existente?.ativo) throw falha(409, 'Já existe um profissional com esse nome.');
  const data = { nome: d.name, ordem: d.order ?? 0, ativo: true, servicos: { set: [] as { id: string }[] } };
  const p = existente
    ? await prisma.profissional.update({ where: { id: existente.id }, data: { ...data, servicos: { set: ids.map((id) => ({ id })) } }, include: { servicos: { select: { id: true } } } })
    : await prisma.profissional.create({ data: { nome: d.name, ordem: d.order ?? 0, servicos: { connect: ids.map((id) => ({ id })) } }, include: { servicos: { select: { id: true } } } });
  return proView(p);
}

export async function atualizarProfissional(id: string, body: unknown) {
  const d = proSchema.partial().parse(body);
  const atual = await prisma.profissional.findUnique({ where: { id } });
  if (!atual || !atual.ativo) throw falha(404, 'Profissional não encontrado.');
  if (d.services) await validarServicos(d.services);
  if (d.name && d.name !== atual.nome) {
    const outro = await prisma.profissional.findUnique({ where: { nome: d.name } });
    if (outro) throw falha(409, 'Já existe um profissional com esse nome.');
  }
  const p = await prisma.profissional.update({
    where: { id },
    data: { nome: d.name, ordem: d.order, ...(d.services ? { servicos: { set: d.services.map((sid) => ({ id: sid })) } } : {}) },
    include: { servicos: { select: { id: true } } },
  });
  return proView(p);
}

// Desativa o profissional. Bloqueia se ainda houver atendimentos futuros em aberto com ele.
export async function removerProfissional(id: string) {
  const atual = await prisma.profissional.findUnique({ where: { id } });
  if (!atual || !atual.ativo) throw falha(404, 'Profissional não encontrado.');
  const ativos = await prisma.profissional.count({ where: { ativo: true } });
  if (ativos <= 1) throw falha(400, 'A barbearia precisa de pelo menos um profissional ativo.');
  const futuros = await prisma.agendamento.count({ where: { profissionalId: id, data: { gte: hoje() }, status: { in: ['agendado', 'confirmado'] } } });
  if (futuros) throw falha(409, `Há ${futuros} atendimento${futuros === 1 ? '' : 's'} futuro${futuros === 1 ? '' : 's'} com este profissional. Cancele ou reagende antes de remover.`);
  await prisma.profissional.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}
