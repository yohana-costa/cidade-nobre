import { Router } from 'express';
import * as c from '../controllers/publico.controller';
import { clienteOpcional } from '../middleware/auth';

// Site do cliente: nao exige login
const router = Router();
router.get('/catalogo', c.catalogoPublico);
router.get('/disponibilidade', clienteOpcional, c.disponibilidade);
router.get('/indicacao/:codigo', c.indicacao);
router.post('/agendamentos', clienteOpcional, c.agendar);
export default router;
