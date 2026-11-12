import { Router } from 'express';
import { config } from '../config/env';
import * as mercadoPago from '../services/mercado-pago.service';
import * as pagamentos from '../services/pagamentos.service';

const router = Router();

// Volta do "Conectar Mercado Pago". Publica de proposito: quem chega aqui e o navegador da
// barbearia redirecionado pelo Mercado Pago. A seguranca e o state assinado (15 minutos).
router.get('/mercado-pago/oauth/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const destino = (s: 'ok' | 'erro') => `${config.siteUrl}/gestao?mp=${s}`;
  if (!code || !state) return res.redirect(destino('erro'));
  try {
    await mercadoPago.finalizarConexao(code, state);
    return res.redirect(destino('ok'));
  } catch (e) {
    console.error('[mercado-pago] volta do OAuth falhou', e);
    return res.redirect(destino('erro'));
  }
});

// Aviso de pagamento. Responde 200 na hora (o Mercado Pago reenvia se demorar) e processa depois;
// o pagamento e sempre conferido na API com o token da barbearia.
router.post('/webhook/mercado-pago', (req, res) => {
  res.sendStatus(200);
  pagamentos.processarAviso(req.query as Record<string, unknown>, req.body).catch((e) => console.error('[mercado-pago] falha ao processar aviso', e));
});
router.get('/webhook/mercado-pago', (_req, res) => res.sendStatus(200));

export default router;
