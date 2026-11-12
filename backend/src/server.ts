import app from './app';
import { config } from './config/env';
import { conciliar } from './services/pagamentos.service';

// Servidor da API (desenvolvimento local e VPS/Docker). Na Vercel quem atende e api/index.ts (sem listen).
app.listen(config.port, () => {
  console.log(`Cidade Nobre: API rodando na porta ${config.port} (${config.nodeEnv})`);
  console.log(`   Health: http://localhost:${config.port}/api/health`);
});

// Pagamentos do site: confere os pendentes e libera os horarios vencidos a cada 2 minutos.
setTimeout(conciliar, 15 * 1000);
setInterval(conciliar, 2 * 60 * 1000);
