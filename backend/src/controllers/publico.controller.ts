import { h } from './_handler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { signCliente } from '../lib/jwt';
import { falha } from '../lib/erros';
import * as catalogo from '../services/catalogo.service';
import * as agenda from '../services/agenda.service';

export const catalogoPublico = h(() => catalogo.catalogoPublico());

// "ignore" so vale para quem esta logado e e dono do agendamento sendo alterado
export const disponibilidade = h<AuthRequest>(async (req) => {
  let ignorar: string | null = null;
  const id = typeof req.query.ignore === 'string' ? req.query.ignore : '';
  if (id && req.clienteId) {
    const a = await prisma.agendamento.findUnique({ where: { id }, select: { clienteId: true } });
    if (a && a.clienteId === req.clienteId) ignorar = id;
  }
  return agenda.disponibilidade(req.query as { serviceIds?: string; proId?: string }, ignorar);
});

// Mostra o primeiro nome de quem indicou ("Voce foi indicado por Joao").
export const indicacao = h(async (req) => {
  const c = await prisma.cliente.findUnique({ where: { codigo: String(req.params.codigo || '').toUpperCase() }, select: { nome: true, codigo: true } });
  if (!c) throw falha(404, 'Link de indicação inválido.');
  return { code: c.codigo, firstName: c.nome.split(/\s+/)[0] };
});

export const agendar = h<AuthRequest>(async (req) => {
  const r = await agenda.agendarPublico(req.body, req.clienteId || null);
  return {
    appt: r.appt,
    account: r.conta,
    passwordIgnored: r.senhaIgnorada,
    // conta criada agora: ja devolve o token para o cliente entrar sem digitar de novo
    token: r.conta === 'criada' ? signCliente(r.clienteId) : undefined,
  };
}, 201);
