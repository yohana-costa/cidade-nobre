import { z } from 'zod';
import { Configuracao } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HORA_RE, hoje, tmin } from '../lib/datas';
import { falha } from '../lib/erros';

// Regras do negocio no formato usado pelas telas (antes eram constantes em core.js).
export interface Cfg {
  pointsPerReal: number;
  referralBonus: number;
  redeemPoints: number;
  redeemValue: number; // reais
  redeemValueCents: number;
  benefitTitle: string;
  openTime: string;
  closeTime: string;
  open: number; // minutos desde 00:00
  close: number;
  dayCap: number; // minutos por profissional por dia aberto
  closedDays: number[];
  slotTimes: string[];
  lapseDays: number;
  minAdvanceMin: number;
  bookingDays: number;
  referralDomain: string;
  clubStart: string;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function toCfg(c: Configuracao): Cfg {
  const open = tmin(c.horaAbertura);
  const close = tmin(c.horaFechamento);
  return {
    pointsPerReal: c.pontosPorReal,
    referralBonus: c.bonusIndicacao,
    redeemPoints: c.resgatePontos,
    redeemValue: c.resgateValorCentavos / 100,
    redeemValueCents: c.resgateValorCentavos,
    benefitTitle: `${BRL.format(c.resgateValorCentavos / 100)} de desconto`,
    openTime: c.horaAbertura,
    closeTime: c.horaFechamento,
    open,
    close,
    dayCap: close - open,
    closedDays: [...c.diasFechados].sort(),
    slotTimes: [...c.horarios].sort(),
    lapseDays: c.diasSemRetorno,
    minAdvanceMin: c.antecedenciaMinutos,
    bookingDays: c.diasAgendamento,
    referralDomain: c.dominioIndicacao,
    clubStart: c.inicioClube || hoje(),
  };
}

// Sempre existe uma linha (id = 1). Se o seed ainda nao rodou, cria com os padroes.
export async function obterConfiguracao(): Promise<Cfg> {
  let c = await prisma.configuracao.findUnique({ where: { id: 1 } });
  if (!c) c = await prisma.configuracao.create({ data: { id: 1, inicioClube: hoje() } });
  return toCfg(c);
}

const hora = z.string().regex(HORA_RE, 'Use o formato HH:MM.');

export const configuracaoSchema = z
  .object({
    pointsPerReal: z.number().int().min(0, 'Pontos por real não pode ser negativo.').max(100),
    referralBonus: z.number().int().min(0).max(100000),
    redeemPoints: z.number().int().min(1, 'A meta de resgate precisa ser de pelo menos 1 ponto.').max(1000000),
    redeemValue: z.number().min(0).max(10000),
    openTime: hora,
    closeTime: hora,
    closedDays: z.array(z.number().int().min(0).max(6)).max(6, 'A barbearia precisa abrir pelo menos um dia.'),
    slotTimes: z.array(hora).min(1, 'Informe ao menos um horário de agendamento.').max(48),
    lapseDays: z.number().int().min(1).max(365),
    minAdvanceMin: z.number().int().min(0).max(1440),
    bookingDays: z.number().int().min(1).max(14),
    referralDomain: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === '' || /^https?:\/\/[^\s/]+(\/[^\s]*)?$/.test(v), 'O domínio do link deve começar com http:// ou https://.'),
  })
  .partial();

export async function atualizarConfiguracao(body: unknown): Promise<Cfg> {
  const d = configuracaoSchema.parse(body);
  const atual = await obterConfiguracao();
  const openTime = d.openTime ?? atual.openTime;
  const closeTime = d.closeTime ?? atual.closeTime;
  if (tmin(openTime) >= tmin(closeTime)) throw falha(400, 'O horário de abertura precisa ser antes do fechamento.');
  const slots = d.slotTimes ? [...new Set(d.slotTimes)].sort() : undefined;
  for (const s of slots ?? atual.slotTimes) {
    if (tmin(s) < tmin(openTime) || tmin(s) >= tmin(closeTime)) {
      throw falha(400, `O horário ${s} fica fora do funcionamento (${openTime} às ${closeTime}).`);
    }
  }
  const c = await prisma.configuracao.update({
    where: { id: 1 },
    data: {
      pontosPorReal: d.pointsPerReal,
      bonusIndicacao: d.referralBonus,
      resgatePontos: d.redeemPoints,
      resgateValorCentavos: d.redeemValue !== undefined ? Math.round(d.redeemValue * 100) : undefined,
      horaAbertura: d.openTime,
      horaFechamento: d.closeTime,
      diasFechados: d.closedDays ? [...new Set(d.closedDays)].sort() : undefined,
      horarios: slots,
      diasSemRetorno: d.lapseDays,
      antecedenciaMinutos: d.minAdvanceMin,
      diasAgendamento: d.bookingDays,
      dominioIndicacao: d.referralDomain !== undefined ? d.referralDomain.replace(/\/+$/, '') : undefined,
    },
  });
  return toCfg(c);
}
