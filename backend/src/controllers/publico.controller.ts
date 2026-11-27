import { h } from './_handler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { signCliente } from '../lib/jwt';
import { falha } from '../lib/erros';
import * as catalogo from '../services/catalogo.service';
import * as agenda from '../services/agenda.service';
import * as pagamentos from '../services/pagamentos.service';
import * as vitrineSvc from '../services/vitrine.service';
import * as cardapioSvc from '../services/cardapio.service';
import * as bar from '../services/pedidos-bar.service';

export const catalogoPublico = h(() => catalogo.catalogoPublico());
// acessorios da loja do Doutor + produtos do estoque da barbearia, no inicio do site
export const vitrine = h(() => vitrineSvc.vitrine());
export const cardapio = h(() => cardapioSvc.cardapioPublico());
export const pedirBar = h<AuthRequest>((req) => bar.criarPedido(req.body, req.ip || 'sem-ip', req.clienteId || null), 201);
export const verPedidoBar = h((req) => bar.verPedido(req.params.id));
// checkout transparente: Pix (QR Code na tela) e cartao (token do formulario do Mercado Pago)
export const pixPedidoBar = h((req) => bar.pagarPix(req.params.id, req.body));
export const cartaoPedidoBar = h((req) => bar.pagarCartao(req.params.id, req.body));

// "ignore" so vale para quem esta logado e e dono do agendamento sendo alterado
async function ignorarDoCliente(req: AuthRequest) {
  const id = typeof req.query.ignore === 'string' ? req.query.ignore : '';
  if (!id || !req.clienteId) return null;
  const a = await prisma.agendamento.findUnique({ where: { id }, select: { clienteId: true } });
  return a && a.clienteId === req.clienteId ? id : null;
}
export const disponibilidade = h<AuthRequest>(async (req) => agenda.disponibilidade(req.query as { serviceIds?: string; proId?: string }, await ignorarDoCliente(req)));
// horario personalizado (ex.: 13:34): confere se cabe e sugere o proximo livre
export const conferirHorario = h<AuthRequest>(async (req) => agenda.conferirHorario(req.query as Record<string, string>, await ignorarDoCliente(req)));

// Mostra o primeiro nome de quem indicou ("Voce foi indicado por Joao").
export const indicacao = h(async (req) => {
  const c = await prisma.cliente.findUnique({ where: { codigo: String(req.params.codigo || '').toUpperCase() }, select: { nome: true, codigo: true } });
  if (!c) throw falha(404, 'Link de indicação inválido.');
  return { code: c.codigo, firstName: c.nome.split(/\s+/)[0] };
});

export const agendar = h<AuthRequest>(async (req) => {
  const r = await pagamentos.agendarComPagamento(req.body, req.clienteId || null);
  return {
    appt: r.appt,
    account: r.conta,
    passwordIgnored: r.senhaIgnorada,
    // conta criada agora: ja devolve o token para o cliente entrar sem digitar de novo
    token: r.conta === 'criada' ? signCliente(r.clienteId) : undefined,
  };
}, 201);

// Volta do Mercado Pago: confere o pagamento na hora e devolve o agendamento atualizado.
export const situacaoPagamento = h((req) => pagamentos.situacao(String(req.params.id)));
