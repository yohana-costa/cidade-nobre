-- Pagamento online do agendamento pelo Mercado Pago (conta da barbearia conectada por OAuth)
ALTER TABLE "configuracoes" ADD COLUMN "cobrarOnline" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "configuracoes" ADD COLUMN "mercadoPagoAccessToken" TEXT;
ALTER TABLE "configuracoes" ADD COLUMN "mercadoPagoRefreshToken" TEXT;
ALTER TABLE "configuracoes" ADD COLUMN "mercadoPagoUserId" TEXT;
ALTER TABLE "configuracoes" ADD COLUMN "mercadoPagoPublicKey" TEXT;
ALTER TABLE "configuracoes" ADD COLUMN "mercadoPagoTokenExpiraEm" TIMESTAMP(3);

ALTER TABLE "agendamentos" ADD COLUMN "pagamentoStatus" TEXT NOT NULL DEFAULT 'nao_exigido';
ALTER TABLE "agendamentos" ADD COLUMN "pagamentoValorCentavos" INTEGER;
ALTER TABLE "agendamentos" ADD COLUMN "pagamentoPreferenciaId" TEXT;
ALTER TABLE "agendamentos" ADD COLUMN "pagamentoLink" TEXT;
ALTER TABLE "agendamentos" ADD COLUMN "pagamentoId" TEXT;
ALTER TABLE "agendamentos" ADD COLUMN "pagamentoExpiraEm" TIMESTAMP(3);
ALTER TABLE "agendamentos" ADD COLUMN "pagoEm" TIMESTAMP(3);

CREATE INDEX "agendamentos_pagamentoStatus_idx" ON "agendamentos"("pagamentoStatus");
