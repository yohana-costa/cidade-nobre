import { h } from './_handler';
import * as relatorios from '../services/relatorios.service';
import * as agenda from '../services/agenda.service';
import * as clientes from '../services/clientes.service';
import * as catalogo from '../services/catalogo.service';
import * as configuracao from '../services/configuracao.service';
import * as mercadoPago from '../services/mercado-pago.service';
import * as cardapioSvc from '../services/cardapio.service';
import * as bar from '../services/pedidos-bar.service';
import * as estoque from '../services/estoque.service';
import { AuthRequest } from '../middleware/auth';

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
export const enviarImagemServico = h((req) => catalogo.enviarImagemServico(req.params.id, req.file));
export const removerImagemServico = h((req) => catalogo.removerImagemServico(req.params.id));
export const enviarFotoProfissional = h((req) => catalogo.enviarFotoProfissional(req.params.id, req.file));
export const removerFotoProfissional = h((req) => catalogo.removerFotoProfissional(req.params.id));
export const enviarFotoCategoria = h((req) => catalogo.enviarFotoCategoria(req.params.id, req.file));
export const removerFotoCategoria = h((req) => catalogo.removerFotoCategoria(req.params.id));

// estoque de produtos
export const painelEstoque = h(() => estoque.painelEstoque());
export const criarProduto = h<AuthRequest>((req) => estoque.criarProduto(req.body, req.user!.id), 201);
export const atualizarProduto = h((req) => estoque.atualizarProduto(req.params.id, req.body));
export const removerProduto = h((req) => estoque.removerProduto(req.params.id));
export const enviarFotoProduto = h((req) => estoque.enviarFotoProduto(req.params.id, req.file));
export const removerFotoProduto = h((req) => estoque.removerFotoProduto(req.params.id));
export const movimentarEstoque = h<AuthRequest>((req) => estoque.movimentar(req.params.id, req.body, req.user!.id));

// regras do negocio
export const obterConfiguracao = h(() => configuracao.obterConfiguracao());
export const atualizarConfiguracao = h((req) => configuracao.atualizarConfiguracao(req.body));

// pagamento online (Mercado Pago)
export const statusMercadoPago = h(() => mercadoPago.statusConexao());
export const conectarMercadoPago = h(async () => mercadoPago.iniciarConexao());
export const desconectarMercadoPago = h(() => mercadoPago.desconectar());
export const cobrancaMercadoPago = h((req) => mercadoPago.definirCobrarOnline(req.body));

// cardapio de bebidas
export const cardapio = h(() => cardapioSvc.cardapioGestao());
export const criarItemCardapio = h((req) => cardapioSvc.criarItem(req.body), 201);
export const atualizarItemCardapio = h((req) => cardapioSvc.atualizarItem(req.params.id, req.body));
export const removerItemCardapio = h((req) => cardapioSvc.removerItem(req.params.id));
export const moverItemCardapio = h((req) => cardapioSvc.moverItem(req.params.id, req.body));
export const enviarFotoCardapio = h((req) => cardapioSvc.enviarFoto(req.params.id, req.file));
export const removerFotoCardapio = h((req) => cardapioSvc.tirarFoto(req.params.id));
export const pedidosBar = h(() => bar.listaGestao());
export const statusPedidoBar = h((req) => bar.mudarStatus(req.params.id, req.body));
