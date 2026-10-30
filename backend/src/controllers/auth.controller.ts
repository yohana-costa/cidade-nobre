import { h } from './_handler';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/auth.service';
import * as usuariosService from '../services/usuarios.service';

export const login = h((req) => authService.login(req.body));
export const me = h<AuthRequest>((req) => authService.getMe(req.user!.id));

export const listarUsuarios = h(() => usuariosService.listarUsuarios());
export const criarUsuario = h((req) => usuariosService.criarUsuario(req.body), 201);
export const atualizarUsuario = h<AuthRequest>((req) => usuariosService.atualizarUsuario(req.params.id, req.body, req.user!.id));
export const alterarSenha = h<AuthRequest>((req) => usuariosService.alterarSenha(req.user!.id, req.body));
