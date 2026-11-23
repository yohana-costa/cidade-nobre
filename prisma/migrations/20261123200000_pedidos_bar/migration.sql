-- CreateTable
CREATE TABLE "pedidos_bar" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "profissionalId" TEXT,
    "observacao" TEXT NOT NULL DEFAULT '',
    "itens" JSONB NOT NULL,
    "totalCentavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "clienteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_bar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_bar_numero_key" ON "pedidos_bar"("numero");

-- CreateIndex
CREATE INDEX "pedidos_bar_status_criadoEm_idx" ON "pedidos_bar"("status", "criadoEm");

