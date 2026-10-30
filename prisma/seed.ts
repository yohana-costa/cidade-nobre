// Seed inicial (idempotente): rode uma vez no banco novo com `npm run db:seed`.
// Cria so o que o sistema precisa para abrir: usuario admin, categorias, catalogo de
// servicos, profissionais e regras padrao. Nao cria clientes, agendamentos nem pontos.
// Rodar de novo nao duplica nada (cada item e procurado pelo nome antes de criar).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hojeBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const CATEGORIAS = [
  { id: 'cabelo', nome: 'Cabelo', ordem: 1 },
  { id: 'barba', nome: 'Barba', ordem: 2 },
  { id: 'cuidados', nome: 'Cuidados', ordem: 3 },
];

// Catalogo do prototipo (precos e duracoes a confirmar com a barbearia; editaveis na gestao)
const SERVICOS = [
  { nome: 'Corte masculino', descricao: 'Do clássico ao degradê', categoriaId: 'cabelo', duracaoMin: 45, preco: 60, imagem: 'svc_corte' },
  { nome: 'Barba e acabamento', descricao: 'Desenho e cuidado', categoriaId: 'barba', duracaoMin: 30, preco: 45, imagem: 'svc_barba' },
  { nome: 'Penteado e finalização', descricao: 'Seu estilo em destaque', categoriaId: 'cabelo', duracaoMin: 20, preco: 30, imagem: 'svc_penteado' },
  { nome: 'Manicure masculina', descricao: 'Cuidado com as mãos', categoriaId: 'cuidados', duracaoMin: 30, preco: 35, imagem: 'svc_manicure' },
  { nome: 'Cuidado nasal', descricao: 'Acabamento dos pelos aparentes', categoriaId: 'cuidados', duracaoMin: 10, preco: 15, imagem: 'svc_nasal' },
  { nome: 'Sobrancelhas', descricao: 'Detalhes que valorizam', categoriaId: 'cuidados', duracaoMin: 15, preco: 20, imagem: 'svc_sobrancelha' },
];

// Profissionais do prototipo e os servicos que cada um realiza (renomeie na gestao)
const PROFISSIONAIS = [
  { nome: 'Barbeiro 01', servicos: ['Corte masculino', 'Barba e acabamento', 'Penteado e finalização', 'Cuidado nasal', 'Sobrancelhas'] },
  { nome: 'Barbeiro 02', servicos: ['Corte masculino', 'Barba e acabamento', 'Penteado e finalização', 'Manicure masculina', 'Cuidado nasal', 'Sobrancelhas'] },
];

async function main() {
  console.log('Seed da Cidade Nobre...');

  // Administrador inicial. TROQUE A SENHA no primeiro acesso (Gestão > Configurações).
  const email = 'admin@cidadenobre.com.br';
  if (!(await prisma.usuario.findUnique({ where: { email } }))) {
    await prisma.usuario.create({ data: { nome: 'Administrador', email, senha: await bcrypt.hash('admin123', 10), perfil: 'ADMIN' } });
    console.log(`  usuário ${email} criado`);
  }

  for (const c of CATEGORIAS) {
    if (!(await prisma.categoria.findUnique({ where: { id: c.id } }))) await prisma.categoria.create({ data: c });
  }

  for (const [i, s] of SERVICOS.entries()) {
    if (await prisma.servico.findUnique({ where: { nome: s.nome } })) continue;
    const { preco, ...resto } = s;
    await prisma.servico.create({ data: { ...resto, precoCentavos: preco * 100, ordem: i + 1 } });
    console.log(`  serviço ${s.nome} criado`);
  }

  for (const [i, p] of PROFISSIONAIS.entries()) {
    if (await prisma.profissional.findUnique({ where: { nome: p.nome } })) continue;
    const servicos = await prisma.servico.findMany({ where: { nome: { in: p.servicos } }, select: { id: true } });
    await prisma.profissional.create({ data: { nome: p.nome, ordem: i + 1, servicos: { connect: servicos } } });
    console.log(`  profissional ${p.nome} criado`);
  }

  if (!(await prisma.configuracao.findUnique({ where: { id: 1 } }))) {
    await prisma.configuracao.create({ data: { id: 1, inicioClube: hojeBrasilia() } });
    console.log('  regras padrão criadas');
  }

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
