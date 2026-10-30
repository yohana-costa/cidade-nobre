import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signEquipe } from '../lib/jwt';
import { falha } from '../lib/erros';

export async function login(body: unknown) {
  const { email, senha } = z
    .object({ email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail.'), senha: z.string().min(1, 'Informe a senha.') })
    .parse(body);
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw falha(401, 'E-mail ou senha incorretos.');
  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) throw falha(401, 'E-mail ou senha incorretos.');
  if (!usuario.ativo) throw falha(403, 'Usuário inativo.');

  const token = signEquipe({ id: usuario.id, email: usuario.email, perfil: usuario.perfil, nome: usuario.nome });
  return { token, user: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil } };
}

export async function getMe(id: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true },
  });
  if (!usuario) throw falha(404, 'Usuário não encontrado.');
  return usuario;
}
