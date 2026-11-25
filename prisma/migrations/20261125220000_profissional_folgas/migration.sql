-- Folga semanal de cada profissional (0 = domingo ... 6 = sabado)
ALTER TABLE "profissionais" ADD COLUMN "folgas" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
