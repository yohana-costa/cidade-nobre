import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = Number(err?.status || err?.statusCode || 500);

  // Erros 4xx sao do dia a dia (validacao, horario ocupado). So 5xx vai com stack para o log.
  if (status >= 500) {
    console.error('[ERROR]', { method: req.method, path: req.originalUrl, name: err?.name, code: err?.code, message: err?.message, stack: err?.stack });
  }

  if (err?.name === 'ZodError') {
    const primeiro = err.errors?.[0];
    return res.status(400).json({
      error: primeiro?.message && primeiro.message !== 'Required' ? primeiro.message : 'Dados inválidos.',
      details: err.errors,
    });
  }

  // JSON mal formado no corpo da requisicao
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpo da requisição inválido.' });
  }

  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado.' });
  }

  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Registro não encontrado.' });
  }

  if (status >= 500) {
    return res.status(status).json({
      error: 'Erro interno do servidor.',
      ...(config.nodeEnv !== 'production' ? { details: { message: err?.message, code: err?.code } } : {}),
    });
  }

  return res.status(status).json({ error: err?.message || 'Erro na requisição.' });
}
