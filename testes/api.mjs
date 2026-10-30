// Teste ponta a ponta da API (precisa da API rodando e do seed aplicado).
//   API_URL=http://localhost:3341 npm run test:api
// Pode rodar varias vezes no mesmo banco: usa telefones e nomes aleatorios.
const API = (process.env.API_URL || 'http://localhost:3341').replace(/\/$/, '') + '/api';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@cidadenobre.com.br', senha: process.env.ADMIN_SENHA || 'admin123' };

let fails = 0, total = 0;
const log = (ok, msg) => { total++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };
async function req(method, path, body, token) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, data };
}
const rnd = () => Math.floor(Math.random() * 1e8);
const phone = () => `119${String(rnd()).padStart(8, '0')}`;
const addDays = (s, n) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n)).toISOString().slice(0, 10);
const dow = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).getUTCDay();

// 1. saude e login da equipe
log((await req('GET', '/health')).status === 200, 'health');
log((await req('POST', '/auth/login', { email: ADMIN.email, senha: 'errada' })).status === 401, 'login com senha errada recusado');
const login = await req('POST', '/auth/login', ADMIN);
const ST = login.data?.token;
log(login.status === 200 && !!ST && login.data.user.perfil === 'ADMIN', 'login do admin');
log((await req('GET', '/gestao/painel')).status === 401, 'gestão sem token recusada');

// 2. catalogo publico
const cat = (await req('GET', '/publico/catalogo')).data;
const S = Object.fromEntries(cat.services.map(s => [s.name, s]));
log(cat.services.length >= 6 && cat.pros.length >= 2 && cat.settings.redeemPoints > 0, `catálogo: ${cat.services.length} serviços, ${cat.pros.length} profissionais`);
const T = cat.today;
const [P1, P2] = cat.pros; // P2 faz manicure no seed

// 3. CRUD de servico e profissional + regras
const nomeSvc = `Hidratação teste ${rnd()}`;
const ns = await req('POST', '/gestao/servicos', { name: nomeSvc, desc: 'Teste', cat: 'cabelo', dur: 25, price: 40, visible: true }, ST);
log(ns.status === 201 && ns.data.price === 40, 'criar serviço');
const us = await req('PUT', `/gestao/servicos/${ns.data.id}`, { price: 55.5, dur: 30, visible: false }, ST);
log(us.status === 200 && us.data.price === 55.5 && us.data.visible === false, 'editar preço, duração e visibilidade');
log(!(await req('GET', '/publico/catalogo')).data.services.some(s => s.id === ns.data.id), 'serviço oculto some do catálogo público');
log((await req('PUT', `/gestao/servicos/${ns.data.id}`, { dur: 500 }, ST)).status === 400, 'duração inválida recusada');
const np = await req('POST', '/gestao/profissionais', { name: `Barbeiro teste ${rnd()}`, services: [S['Corte masculino'].id, ns.data.id] }, ST);
log(np.status === 201 && np.data.services.length === 2, 'criar profissional com serviços');
log((await req('PUT', `/gestao/profissionais/${np.data.id}`, { services: [] }, ST)).status === 400, 'profissional sem serviço recusado');
log((await req('DELETE', `/gestao/profissionais/${np.data.id}`, null, ST)).status === 200, 'remover profissional');
log((await req('DELETE', `/gestao/servicos/${ns.data.id}`, null, ST)).status === 200, 'remover serviço');
const cfg0 = (await req('GET', '/gestao/configuracoes', null, ST)).data;
log((await req('PUT', '/gestao/configuracoes', { openTime: '19:00', closeTime: '09:00' }, ST)).status === 400, 'regra inválida (abre depois de fechar) recusada');
const up = await req('PUT', '/gestao/configuracoes', { lapseDays: 46 }, ST);
log(up.status === 200 && up.data.lapseDays === 46, 'alterar regra (dias sem retorno)');
await req('PUT', '/gestao/configuracoes', { lapseDays: cfg0.lapseDays }, ST);
const opEmail = `operador${rnd()}@teste.local`;
await req('POST', '/usuarios', { nome: 'Operador Teste', email: opEmail, senha: 'operador123', perfil: 'OPERADOR' }, ST);
const OT = (await req('POST', '/auth/login', { email: opEmail, senha: 'operador123' })).data?.token;
log((await req('PUT', '/gestao/configuracoes', { lapseDays: 10 }, OT)).status === 403 && (await req('GET', '/gestao/agenda', null, OT)).status === 200, 'operador vê a agenda mas não altera regras');

// 4. agendamento pelo site (sem conta) + indicacao
const corte = S['Corte masculino'].id;
const av = (await req('GET', `/publico/disponibilidade?serviceIds=${corte}&proId=${P1.id}`)).data;
const dia = av.days.find(d => d.date > T && d.slots.filter(s => s.proId).length >= 3);
const livres = dia.slots.filter(s => s.proId).map(s => s.time);
const phA = phone(), phB = phone();
const bA = await req('POST', '/publico/agendamentos', { serviceIds: [corte], proId: P1.id, date: dia.date, time: livres[0], name: 'Amigo Indicador', phone: phA, password: 'senha123' });
log(bA.status === 201 && bA.data.account === 'criada' && !!bA.data.token, 'agendar sem conta criando senha devolve token');
const AT = bA.data.token;
const contaA = (await req('GET', '/conta', null, AT)).data;
const codeA = contaA.client.code;
log(/^CN[A-Z0-9]{5}$/.test(codeA), `código de indicação ${codeA}`);
log((await req('GET', `/publico/indicacao/${codeA}`)).data?.firstName === 'Amigo', 'link de indicação identifica quem indicou');
const bB = await req('POST', '/publico/agendamentos', { serviceIds: [corte], proId: P1.id, date: dia.date, time: livres[1], name: 'Bruno Indicado', phone: phB, referralCode: codeA });
log(bB.status === 201 && bB.data.account === 'sem-conta' && !bB.data.token, 'agendar sem conta e sem senha');
const dup = await req('POST', '/publico/agendamentos', { serviceIds: [corte], proId: P1.id, date: dia.date, time: livres[1], name: 'Outro Cliente', phone: phone() });
log(dup.status === 409, 'dupla reserva do mesmo profissional recusada (409)');
const corrida = await Promise.all([0, 1, 2].map(() => req('POST', '/publico/agendamentos', { serviceIds: [corte], proId: P1.id, date: dia.date, time: livres[2], name: 'Cliente Corrida', phone: phone() })));
log(corrida.filter(r => r.status === 201).length === 1 && corrida.filter(r => r.status === 409).length === 2, `3 reservas simultâneas no mesmo horário: ${corrida.map(r => r.status).join(', ')}`);
log((await req('POST', '/publico/agendamentos', { serviceIds: [corte], proId: P1.id, date: dia.date, time: '12:07', name: 'Fora Grade', phone: phone() })).status === 400, 'horário fora da grade recusado');
const reusa = await req('POST', '/publico/agendamentos', { serviceIds: [corte], proId: 'any', date: dia.date, time: livres[3] || livres[0], name: 'Nome Trocado', phone: phA, password: 'tentativa' });
log([201, 409].includes(reusa.status) && (reusa.status === 409 || (reusa.data.account === 'existente' && reusa.data.passwordIgnored && !reusa.data.token)), 'telefone com conta: agenda sem trocar dados nem senha');
log((await req('GET', '/conta', null, AT)).data.client.name === 'Amigo Indicador', 'nome do cadastro preservado');

// 5. conclusao, pontos, indicacao, resgate e voucher (atendimentos de balcao em datas passadas)
async function balcao(clientId, serviceIds, proId) {
  for (let back = 2; back < 29; back++) {
    const date = addDays(T, -back);
    if (cat.settings.closedDays.includes(dow(date))) continue;
    for (let m = 9 * 60; m <= 16 * 60; m += 30) {
      const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const r = await req('POST', '/gestao/agendamentos', { clientId, serviceIds, proId, date, time }, ST);
      if (r.status === 201) return r.data;
      if (r.status !== 409 && r.status !== 400) throw new Error(JSON.stringify(r.data));
    }
  }
  throw new Error('sem horário livre para o teste');
}
const contaIdB = (await req('GET', '/gestao/clientes', null, ST)).data.rows.find(r => r.c.phone.replace(/\D/g, '') === phB).c.id;
const p30a = (await req('GET', '/gestao/painel?periodo=30', null, ST)).data.cur;
const aB = await balcao(contaIdB, [corte], P1.id);
const cB = await req('PATCH', `/gestao/agendamentos/${aB.id}/status`, { status: 'concluido' }, ST);
log(cB.status === 200 && cB.data.points === 60 && cB.data.referral?.points === 50, `concluir 1º atendimento do indicado: +${cB.data.points} pts e +${cB.data.referral?.points} de indicação`);
const cB2 = await req('PATCH', `/gestao/agendamentos/${aB.id}/status`, { status: 'concluido' }, ST);
const cB3 = await Promise.all([1, 2].map(() => req('PATCH', `/gestao/agendamentos/${aB.id}/status`, { status: 'concluido' }, ST)));
log(cB2.status === 409 && cB3.every(r => r.status === 409), 'concluir de novo não credita outra vez (409)');
const futuro = await req('PATCH', `/gestao/agendamentos/${bB.data.appt.id}/status`, { status: 'concluido' }, ST);
log(futuro.status === 400, 'atendimento futuro não pode ser concluído');
const todos = Object.values(S).filter(s => P2.services.includes(s.id)).map(s => s.id);
const totalTodos = Object.values(S).filter(s => P2.services.includes(s.id)).reduce((t, s) => t + s.price, 0);
const aA = await balcao(contaA.client.id, todos, P2.id);
const cA = await req('PATCH', `/gestao/agendamentos/${aA.id}/status`, { status: 'concluido' }, ST);
log(cA.status === 200 && cA.data.points === totalTodos && !cA.data.referral, `concluir atendimento de ${totalTodos} reais: +${cA.data.points} pts`);
let mA = (await req('GET', '/conta', null, AT)).data;
log(mA.club.balance === totalTodos + 50 && mA.club.eligible, `saldo do indicador ${mA.club.balance} (serviço + indicação)`);
const [r1, r2] = await Promise.all([req('POST', '/conta/resgatar', null, AT), req('POST', '/conta/resgatar', null, AT)]);
log([r1.status, r2.status].sort().join() === '200,400', `dois resgates simultâneos: só um passa (${r1.status}, ${r2.status})`);
mA = (await req('GET', '/conta', null, AT)).data;
const custo = cat.settings.redeemPoints, valor = cat.settings.redeemValue;
log(mA.club.balance === totalTodos + 50 - custo && mA.vouchers.filter(v => v.status === 'disponivel').length === 1, `resgate consome ${custo} pts e gera benefício`);
const aA2 = await balcao(contaA.client.id, [corte], P1.id);
const cA2 = await req('PATCH', `/gestao/agendamentos/${aA2.id}/status`, { status: 'concluido' }, ST);
log(cA2.data.voucher?.value === valor && cA2.data.points === 60 - valor && cA2.data.appt.discount === valor, `benefício aplicado na conclusão seguinte: -R$ ${valor}, +${cA2.data.points} pts`);
const aA3 = await balcao(contaA.client.id, [corte], P1.id);
const cA3 = await req('PATCH', `/gestao/agendamentos/${aA3.id}/status`, { status: 'concluido' }, ST);
log(!cA3.data.voucher && cA3.data.points === 60, 'benefício usado uma vez só');
mA = (await req('GET', '/conta', null, AT)).data;
log(mA.moves.length === 5 && mA.club.balance === totalTodos + 50 - custo + (60 - valor) + 60, `extrato com ${mA.moves.length} movimentos, saldo ${mA.club.balance}`);

// 6. metricas no servidor
const p30b = (await req('GET', '/gestao/painel?periodo=30', null, ST)).data;
const esperado = 60 + totalTodos + (60 - valor) + 60;
log(Math.round(p30b.cur.rev - p30a.rev) === esperado && p30b.cur.done - p30a.done === 4, `painel 30 dias: faturamento +${p30b.cur.rev - p30a.rev} (esperado ${esperado}), concluídos +${p30b.cur.done - p30a.done}`);
const ph = (await req('GET', '/gestao/painel?periodo=hoje', null, ST)).data;
const p7 = (await req('GET', '/gestao/painel?periodo=7', null, ST)).data;
log(ph.chart.kind === 'hours' && p7.chart.points.length === 7 && p30b.chart.points.length === 30, 'gráficos de hoje (por hora), 7 e 30 dias');
log(p30b.chart.points.reduce((t, p) => t + p.value, 0) === p30b.cur.rev, 'soma do gráfico = faturamento do período');
const fid = (await req('GET', '/gestao/fidelidade', null, ST)).data;
log(fid.referrals.some(r => r.referredName === 'Bruno Indicado' && r.status === 'concluida'), 'fidelidade lista a indicação concluída');
const opp = (await req('GET', '/gestao/oportunidades', null, ST)).data;
log(Object.keys(opp.lists).length === 5, 'oportunidades com 5 listas');

// 7. conta do cliente: privacidade e primeiro acesso
log((await req('POST', '/conta/entrar', { phone: phB, password: 'qualquer' })).status === 401, 'cliente sem senha não entra só com telefone');
log((await req('GET', '/conta', null, ST)).status === 401, 'token da equipe não abre conta de cliente');
log((await req('GET', '/gestao/painel', null, AT)).status === 401, 'token de cliente não abre a gestão');
log((await req('POST', `/conta/agendamentos/${bB.data.appt.id}/cancelar`, null, AT)).status === 404, 'cliente não cancela agendamento de outro');
const code = (await req('POST', `/gestao/clientes/${contaIdB}/codigo-acesso`, null, ST)).data.code;
log((await req('POST', '/conta/primeiro-acesso', { phone: phB, code: code === '000000' ? '111111' : '000000', password: 'nova123' })).status === 401, 'código de acesso errado recusado');
const pa = await req('POST', '/conta/primeiro-acesso', { phone: phB, code, password: 'nova123' });
log(pa.status === 200 && !!pa.data.token, 'primeiro acesso com código da barbearia');
const BT = (await req('POST', '/conta/entrar', { phone: phB, password: 'nova123' })).data?.token;
const mB = (await req('GET', '/conta', null, BT)).data;
log(mB.club.balance === 60 && mB.referralGot?.status === 'concluida', `cliente indicado vê os próprios ${mB.club.balance} pts`);
const outroDia = av.days.find(d => d.date > dia.date) || dia;
const alt = await req('PUT', `/conta/agendamentos/${bB.data.appt.id}`, { serviceIds: [corte], proId: 'any', date: outroDia.date, time: outroDia.slots.find(s => s.proId)?.time }, BT);
log(alt.status === 200 && alt.data.date === outroDia.date, 'cliente altera o próprio horário');
log((await req('POST', `/conta/agendamentos/${bB.data.appt.id}/cancelar`, null, BT)).data?.status === 'cancelado', 'cliente cancela o próprio horário');
const re = await req('PATCH', `/gestao/agendamentos/${bB.data.appt.id}/status`, { status: 'agendado' }, ST);
log([200, 409].includes(re.status), `reativar cancelado confere o horário (${re.status})`);

console.log(`\n${total - fails}/${total} verificações passaram.`);
process.exit(fails ? 1 : 0);
