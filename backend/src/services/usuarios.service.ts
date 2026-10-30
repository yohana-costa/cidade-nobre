import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';

const select = { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true };
const perfil = z.enum(['ADMIN', 'GERENTE', 'OPERADOR']);

export async function listarUsuarios() {
  return prisma.usuario.findMany({ select, orderBy: { nome: 'asc' } });
}

export async function criarUsuario(body: unknown) {
  const d = z
    .object({
      nome: z.string().trim().min(2, 'Informe o nome.').max(80),
      email: z.string().trim().toLowerCase().email('E-mail inválido.'),
      senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.').max(72),
      perfil: perfil.default('OPERADOR'),
    })
    .parse(body);
  const existe = await prisma.usuario.findUnique({ where: { email: d.email } });
  if (existe) throw falha(409, 'E-mail já cadastrado.');
  return prisma.usuario.create({ data: { ...d, senha: await bcrypt.hash(d.senha, 10) }, select });
}

export async function atualizarUsuario(id: string, body: unknown, quemPede: string) {
  const d = z
    .object({
      nome: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email('E-mail inválido.'),
      senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.').max(72),
      perfil,
      ativo: z.boolean(),
    })
    .partial()
    .parse(body);
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw falha(404, 'Usuário não encontrado.');
  // nao deixa o sistema ficar sem nenhum administrador ativo
  const deixaDeSerAdmin = usuario.perfil === 'ADMIN' && ((d.perfil && d.perfil !== 'ADMIN') || d.ativo === false);
  if (deixaDeSerAdmin) {
    const admins = await prisma.usuario.count({ where: { perfil: 'ADMIN', ativo: true } });
    if (admins <= 1) throw falha(400, 'Mantenha ao menos um administrador ativo.');
  }
  if (id === quemPede && d.ativo === false) throw falha(400, 'Você não pode desativar o próprio acesso.');
  if (d.email && d.email !== usuario.email) {
    const outro = await prisma.usuario.findUnique({ where: { email: d.email } });
    if (outro) throw falha(409, 'E-mail já cadastrado.');
  }
  return prisma.usuario.update({
    where: { id },
    data: { ...d, senha: d.senha ? await bcrypt.hash(d.senha, 10) : undefined },
    select,
  });
}

export async function alterarSenha(id: string, body: unknown) {
  const { senhaAtual, novaSenha } = z
    .object({ senhaAtual: z.string().min(1, 'Informe a senha atual.'), novaSenha: z.string().min(6, 'A nova senha precisa ter pelo menos 6 caracteres.').max(72) })
    .parse(body);
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw falha(404, 'Usuário não encontrado.');
  if (!(await bcrypt.compare(senhaAtual, usuario.senha))) throw falha(401, 'Senha atual incorreta.');
  await prisma.usuario.update({ where: { id }, data: { senha: await bcrypt.hash(novaSenha, 10) } });
  return { message: 'Senha alterada com sucesso.' };
}
