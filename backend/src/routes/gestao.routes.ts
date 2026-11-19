import { Router } from 'express';
import * as c from '../controllers/gestao.controller';
import { authMiddleware, requireAdmin, requireGerente } from '../middleware/auth';
import { upload } from '../middleware/upload';

// Gestao da barbearia: toda rota exige login da equipe.
// OPERADOR: agenda, clientes, listas e movimentar o estoque. GERENTE: + servicos, equipe e cadastro de produtos. ADMIN: + regras e usuarios.
const router = Router();
router.use(authMiddleware);

router.get('/painel', c.painel);
router.get('/contadores', c.contadores);
router.get('/agenda', c.agendaDoDia);
router.post('/agendamentos', c.criarAgendamento);
router.get('/agendamentos/:id', c.detalheAgendamento);
router.patch('/agendamentos/:id/status', c.alterarStatus);

router.get('/clientes', c.listaClientes);
router.get('/clientes/busca', c.buscarClientes);
router.get('/clientes/:id', c.detalheCliente);
router.put('/clientes/:id', c.atualizarCliente);
router.post('/clientes/:id/codigo-acesso', c.codigoAcesso);

router.get('/fidelidade', c.fidelidade);
router.get('/oportunidades', c.oportunidades);

router.get('/catalogo', c.catalogoGestao);
router.post('/servicos', requireGerente, c.criarServico);
router.put('/servicos/:id', requireGerente, c.atualizarServico);
router.delete('/servicos/:id', requireGerente, c.removerServico);
router.post('/servicos/:id/imagem', requireGerente, upload.single('imagem'), c.enviarImagemServico);
router.delete('/servicos/:id/imagem', requireGerente, c.removerImagemServico);
router.post('/profissionais', requireGerente, c.criarProfissional);
router.put('/profissionais/:id', requireGerente, c.atualizarProfissional);
router.delete('/profissionais/:id', requireGerente, c.removerProfissional);
router.post('/profissionais/:id/foto', requireGerente, upload.single('imagem'), c.enviarFotoProfissional);
router.delete('/profissionais/:id/foto', requireGerente, c.removerFotoProfissional);

router.get('/estoque', c.painelEstoque);
router.post('/produtos', requireGerente, c.criarProduto);
router.put('/produtos/:id', requireGerente, c.atualizarProduto);
router.delete('/produtos/:id', requireGerente, c.removerProduto);
router.post('/produtos/:id/foto', requireGerente, upload.single('imagem'), c.enviarFotoProduto);
router.delete('/produtos/:id/foto', requireGerente, c.removerFotoProduto);
router.post('/produtos/:id/movimentos', c.movimentarEstoque);

router.get('/configuracoes', c.obterConfiguracao);
router.put('/configuracoes', requireAdmin, c.atualizarConfiguracao);

router.get('/mercado-pago', c.statusMercadoPago);
router.get('/mercado-pago/conectar', requireAdmin, c.conectarMercadoPago);
router.post('/mercado-pago/desconectar', requireAdmin, c.desconectarMercadoPago);
router.put('/mercado-pago', requireAdmin, c.cobrancaMercadoPago);
export default router;
