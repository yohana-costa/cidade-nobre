import { Router } from 'express';
import * as c from '../controllers/auth.controller';
import { authMiddleware, requireAdmin } from '../middleware/auth';

// Login da equipe e gestao de usuarios
export const authRoutes = Router();
authRoutes.post('/login', c.login);
authRoutes.get('/me', authMiddleware, c.me);

export const usuariosRoutes = Router();
usuariosRoutes.use(authMiddleware);
// alterar a propria senha: qualquer usuario logado
usuariosRoutes.post('/senha', c.alterarSenha);
// gerenciar usuarios: so administrador
usuariosRoutes.get('/', requireAdmin, c.listarUsuarios);
usuariosRoutes.post('/', requireAdmin, c.criarUsuario);
usuariosRoutes.put('/:id', requireAdmin, c.atualizarUsuario);
