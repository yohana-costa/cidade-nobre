import { Router } from 'express';
import * as c from '../controllers/conta.controller';
import { clienteAuth } from '../middleware/auth';

// Conta do cliente (telefone + senha): Clube, Perfil e os proprios agendamentos
const router = Router();
router.post('/entrar', c.entrar);
router.post('/primeiro-acesso', c.primeiroAcesso);
router.use(clienteAuth);
router.get('/', c.minhaConta);
router.put('/', c.atualizarDados);
router.post('/senha', c.alterarSenha);
router.post('/resgatar', c.resgatar);
router.put('/agendamentos/:id', c.alterarAgendamento);
router.post('/agendamentos/:id/cancelar', c.cancelarAgendamento);
export default router;
