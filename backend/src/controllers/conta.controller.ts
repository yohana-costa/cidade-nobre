import { h } from './_handler';
import { AuthRequest } from '../middleware/auth';
import * as clientes from '../services/clientes.service';
import * as agenda from '../services/agenda.service';

export const entrar = h((req) => clientes.entrar(req.body));
export const primeiroAcesso = h((req) => clientes.primeiroAcesso(req.body));
export const minhaConta = h<AuthRequest>((req) => clientes.minhaConta(req.clienteId!));
export const atualizarDados = h<AuthRequest>((req) => clientes.atualizarDados(req.clienteId!, req.body));
export const alterarSenha = h<AuthRequest>((req) => clientes.alterarSenhaCliente(req.clienteId!, req.body));
export const resgatar = h<AuthRequest>((req) => clientes.resgatar(req.clienteId!));
export const alterarAgendamento = h<AuthRequest>((req) => agenda.alterarDoCliente(req.params.id, req.clienteId!, req.body));
export const cancelarAgendamento = h<AuthRequest>((req) => agenda.cancelarDoCliente(req.params.id, req.clienteId!));
