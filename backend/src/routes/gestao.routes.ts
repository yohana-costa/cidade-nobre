import { Router } from 'express';
import * as c from '../controllers/gestao.controller';
import { authMiddleware, requireAdmin, requireGerente } from '../middleware/auth';

// Gestao da barbearia: toda rota exige login da equipe.
// OPERADOR: agenda, clientes e listas. GERENTE: + servicos e equipe. ADMIN: + regras e usuarios.
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
router.post('/profissionais', requireGerente, c.criarProfissional);
router.put('/profissionais/:id', requireGerente, c.atualizarProfissional);
router.delete('/profissionais/:id', requireGerente, c.removerProfissional);

router.get('/configuracoes', c.obterConfiguracao);
router.put('/configuracoes', requireAdmin, c.atualizarConfiguracao);
export default router;
