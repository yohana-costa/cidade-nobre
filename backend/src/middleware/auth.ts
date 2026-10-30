import { Request, Response, NextFunction } from 'express';
import { verifyToken, EquipePayload } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: EquipePayload;
  clienteId?: string;
}

function lerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

// Equipe da barbearia (gestao). Confere no banco se o usuario continua ativo,
// assim desativar alguem corta o acesso na hora, sem esperar o token expirar.
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = lerToken(req);
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const payload = verifyToken(token);
    if (payload.tipo !== 'equipe') return res.status(401).json({ error: 'Token inválido para a gestão.' });
    const u = await prisma.usuario.findUnique({ where: { id: payload.id }, select: { ativo: true, perfil: true, nome: true, email: true } });
    if (!u || !u.ativo) return res.status(401).json({ error: 'Usuário inativo ou removido.' });
    req.user = { ...payload, perfil: u.perfil, nome: u.nome, email: u.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.perfil !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

export function requireGerente(req: AuthRequest, res: Response, next: NextFunction) {
  if (!['ADMIN', 'GERENTE'].includes(req.user?.perfil || '')) {
    return res.status(403).json({ error: 'Acesso restrito a gerentes e administradores.' });
  }
  next();
}

// Cliente logado (telefone + senha). Obrigatorio.
export async function clienteAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = lerToken(req);
  if (!token) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
  try {
    const payload = verifyToken(token);
    if (payload.tipo !== 'cliente') return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
    const c = await prisma.cliente.findUnique({ where: { id: payload.id }, select: { id: true, senha: true } });
    if (!c || !c.senha) return res.status(401).json({ error: 'Sessão encerrada. Entre novamente.' });
    req.clienteId = c.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  }
}

// Cliente logado opcional (ex.: agendamento funciona com ou sem conta).
// Token invalido aqui e ignorado: a pessoa segue como visitante.
export async function clienteOpcional(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = lerToken(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.tipo === 'cliente') {
        const c = await prisma.cliente.findUnique({ where: { id: payload.id }, select: { id: true, senha: true } });
        if (c && c.senha) req.clienteId = c.id;
      }
    } catch {
      /* visitante */
    }
  }
  next();
}
