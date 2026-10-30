import jwt from 'jsonwebtoken';
import { config } from '../config/env';

// Dois tipos de token, assinados com o mesmo segredo mas nunca intercambiaveis:
// o middleware da equipe recusa token de cliente e vice-versa (campo "tipo").
export interface EquipePayload {
  tipo: 'equipe';
  id: string;
  email: string;
  perfil: string;
  nome: string;
}

export interface ClientePayload {
  tipo: 'cliente';
  id: string;
}

export type JwtPayload = EquipePayload | ClientePayload;

export function signEquipe(payload: Omit<EquipePayload, 'tipo'>): string {
  return jwt.sign({ ...payload, tipo: 'equipe' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export function signCliente(id: string): string {
  return jwt.sign({ tipo: 'cliente', id }, config.jwtSecret, { expiresIn: config.jwtClienteExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
