import { config } from '../config/env';

// Datas de agenda sao texto "AAAA-MM-DD" e horas "HH:MM" no fuso do negocio.
// Toda a aritmetica de dias usa UTC puro para nao depender do fuso do servidor.

export const pad = (n: number) => String(n).padStart(2, '0');

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partes(d: Date) {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

export const hoje = () => partes(new Date()).data;
export const agoraMin = () => tmin(partes(new Date()).hora);
// "AAAA-MM-DD HH:MM" no fuso do negocio (formato usado nas telas)
export const carimbo = (d: Date) => {
  const p = partes(d);
  return `${p.data} ${p.hora}`;
};
export const dataDe = (d: Date) => partes(d).data;

const utc = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (s: string, n: number) => new Date(utc(s) + n * 86400000).toISOString().slice(0, 10);
export const dow = (s: string) => new Date(utc(s)).getUTCDay();
export const diffDays = (a: string, b: string) => Math.round((utc(a) - utc(b)) / 86400000);
export const tmin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const tstr = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export const DATA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// formatos usados nos textos que o servidor monta (ex.: listas de oportunidades)
export const fDM = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const fRel = (s: string, T: string) => {
  const n = diffDays(s, T);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n < 0 ? `há ${-n} dias` : `em ${n} dias`;
};
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const money0 = (v: number) => BRL0.format(Math.round(v));
