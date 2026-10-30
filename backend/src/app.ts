import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { logger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes, usuariosRoutes } from './routes/auth.routes';
import publicoRoutes from './routes/publico.routes';
import contaRoutes from './routes/conta.routes';
import gestaoRoutes from './routes/gestao.routes';

// App Express sem listen: usado pela funcao da Vercel (api/index.ts) e pelo server.ts local.
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Em producao site e API ficam no mesmo dominio; CORS so quando CORS_ORIGINS estiver definido.
if (config.corsOrigins.length) {
  app.use(cors({ origin: config.corsOrigins }));
}
app.use(express.json({ limit: '100kb' }));
app.use(logger);

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/publico', publicoRoutes);
app.use('/api/conta', contaRoutes);
app.use('/api/gestao', gestaoRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.use(errorHandler);

export default app;
