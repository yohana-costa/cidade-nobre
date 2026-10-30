import { h } from './_handler';
import * as relatorios from '../services/relatorios.service';
import * as agenda from '../services/agenda.service';
import * as clientes from '../services/clientes.service';
import * as catalogo from '../services/catalogo.service';
import * as configuracao from '../services/configuracao.service';

const q = (v: unknown) => (typeof v === 'string' ? v : '');

// leitura (indicadores e listas)
export const painel = h((req) => relatorios.painel(q(req.query.periodo)));
export const contadores = h(() => relatorios.contadores());
export const agendaDoDia = h((req) => relatorios.agendaDoDia(q(req.query.data)));
export const detalheAgendamento = h((req) => relatorios.detalheAgendamento(req.params.id));
export const listaClientes = h(() => relatorios.listaClientes());
export const fidelidade = h(() => relatorios.fidelidade());
export const oportunidades = h(() => relatorios.oportunidades());
export const catalogoGestao = h(() => relatorios.catalogoGestao());

// agenda
export const criarAgendamento = h((req) => agenda.agendarEquipe(req.body), 201);
export const alterarStatus = h((req) => agenda.alterarStatus(req.params.id, req.body));

// clientes
export const buscarClientes = h(async (req) => clientes.buscarCliente(q(req.query.q)));
export const detalheCliente = h((req) => clientes.visaoCliente(req.params.id));
export const atualizarCliente = h((req) => clientes.atualizarClienteEquipe(req.params.id, req.body));
export const codigoAcesso = h((req) => clientes.gerarCodigoAcesso(req.params.id));

// servicos e equipe
export const criarServico = h((req) => catalogo.criarServico(req.body), 201);
export const atualizarServico = h((req) => catalogo.atualizarServico(req.params.id, req.body));
export const removerServico = h((req) => catalogo.removerServico(req.params.id));
export const criarProfissional = h((req) => catalogo.criarProfissional(req.body), 201);
export const atualizarProfissional = h((req) => catalogo.atualizarProfissional(req.params.id, req.body));
export const removerProfissional = h((req) => catalogo.removerProfissional(req.params.id));

// regras do negocio
export const obterConfiguracao = h(() => configuracao.obterConfiguracao());
export const atualizarConfiguracao = h((req) => configuracao.atualizarConfiguracao(req.body));
