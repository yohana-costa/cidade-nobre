import { PrismaClient } from '@prisma/client';

// Um unico PrismaClient por processo. Na Vercel a mesma instancia da funcao atende
// varias requisicoes seguidas, entao o cliente fica guardado em globalThis (tambem em
// producao) para nao abrir uma conexao nova a cada chamada.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;
