ALTER TABLE "pedidos_bar" ADD COLUMN "pagamentoStatus" TEXT NOT NULL DEFAULT 'nenhum';
ALTER TABLE "pedidos_bar" ADD COLUMN "pagamentoLink" TEXT;
ALTER TABLE "pedidos_bar" ADD COLUMN "pagamentoId" TEXT;
ALTER TABLE "pedidos_bar" ADD COLUMN "pagamentoExpiraEm" TIMESTAMP(3);
ALTER TABLE "pedidos_bar" ADD COLUMN "pagoEm" TIMESTAMP(3);
CREATE INDEX "pedidos_bar_pagamentoStatus_idx" ON "pedidos_bar"("pagamentoStatus");
