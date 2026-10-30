// Gera os dados de demonstração simulando cada dia de um ano, em três horários,
// e confere que nada quebra e que o roteiro da apresentação continua válido
// (Lucas com 180 pts; atendimentos do Lucas e do Diego confirmados no mesmo dia).
//   npm run test:datas
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core.js');
const code = fs.readFileSync(CORE, 'utf8');
const days = +(process.argv[2] || 366);
let bad = 0, runs = 0;
for (const hour of [8, 13, 21]) for (let i = 0; i < days; i++) {
  runs++;
  const base = new Date(); base.setHours(hour, 30, 0, 0);
  const now = new Date(base.getTime() + i * 86400000);
  class FDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now.getTime()); } static now() { return now.getTime(); } }
  const ctx = { Date: FDate, Intl, Math, JSON, String, Number, Object, Array, Set, Map, console, localStorage: { getItem() { return null; }, setItem() {} }, window: {} };
  vm.createContext(ctx);
  try {
    vm.runInContext(code + '\n;load(); globalThis.__r = { DB, T: todayStr(), b: balance("c1"), c1: DB.appts.filter(a => a.clientId==="c1" && (a.status==="confirmado")).map(a=>a.date), c3: DB.appts.filter(a => a.clientId==="c3" && a.status==="confirmado").map(a=>a.date), lucasMv: DB.moves.filter(m=>m.clientId==="c1").map(m=>m.type+":"+m.points) };', ctx);
    const r = ctx.__r;
    const D0ok = r.c1.length === 1 && r.c3.length === 1 && r.c1[0] === r.c3[0];
    const ok = r.b === 180 && D0ok;
    if (!ok) { bad++; console.log('INVARIANT', r.T, ['dom','seg','ter','qua','qui','sex','sáb'][now.getDay()], r.b, r.c1, r.c3, r.lucasMv.join(',')); }
  } catch (e) { bad++; console.log('CRASH', now.toDateString(), e.message); }
}
console.log(`${runs - bad}/${runs} simulações ok (${days} dias × 3 horários)`);
process.exit(bad ? 1 : 0);
