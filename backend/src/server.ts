import app from './app';
import { config } from './config/env';

// Servidor local de desenvolvimento. Na Vercel quem atende e api/index.ts (sem listen).
app.listen(config.port, () => {
  console.log(`Cidade Nobre: API rodando na porta ${config.port} (${config.nodeEnv})`);
  console.log(`   Health: http://localhost:${config.port}/api/health`);
});
