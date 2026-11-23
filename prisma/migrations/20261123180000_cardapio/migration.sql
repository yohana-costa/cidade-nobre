-- CreateTable
CREATE TABLE "cardapio_itens" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precoCentavos" INTEGER NOT NULL DEFAULT 0,
    "foto" TEXT,
    "visivel" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cardapio_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cardapio_itens_categoria_ordem_idx" ON "cardapio_itens"("categoria", "ordem");

-- Cardapio inicial (o mesmo do modelo aprovado pela barbearia); a gestao edita depois
INSERT INTO "cardapio_itens" ("id", "nome", "categoria", "precoCentavos", "foto", "ordem", "atualizadoEm") VALUES
('cardapio-gin-tonica', 'Gin Tônica', 'drinks', 2900, '/assets/cardapio/gin-tonica.jpg', 1, CURRENT_TIMESTAMP),
('cardapio-moscow-mule', 'Moscow Mule', 'drinks', 3200, '/assets/cardapio/moscow-mule.jpg', 2, CURRENT_TIMESTAMP),
('cardapio-negroni', 'Negroni', 'drinks', 3400, '/assets/cardapio/negroni.jpg', 3, CURRENT_TIMESTAMP),
('cardapio-aperol-spritz', 'Aperol Spritz', 'drinks', 3000, '/assets/cardapio/aperol-spritz.jpg', 4, CURRENT_TIMESTAMP),
('cardapio-old-fashioned', 'Old Fashioned', 'drinks', 3600, '/assets/cardapio/old-fashioned.jpg', 5, CURRENT_TIMESTAMP),
('cardapio-caipirinha', 'Caipirinha', 'drinks', 2600, '/assets/cardapio/caipirinha.jpg', 6, CURRENT_TIMESTAMP),
('cardapio-heineken', 'Heineken', 'cervejas', 1400, '/assets/cardapio/heineken.jpg', 1, CURRENT_TIMESTAMP),
('cardapio-corona', 'Corona', 'cervejas', 1600, '/assets/cardapio/corona.jpg', 2, CURRENT_TIMESTAMP),
('cardapio-stella-artois', 'Stella Artois', 'cervejas', 1500, '/assets/cardapio/stella-artois.jpg', 3, CURRENT_TIMESTAMP),
('cardapio-budweiser', 'Budweiser', 'cervejas', 1300, '/assets/cardapio/budweiser.jpg', 4, CURRENT_TIMESTAMP),
('cardapio-jack-daniels', 'Jack Daniel''s', 'whisky', 2400, '/assets/cardapio/jack-daniels.jpg', 1, CURRENT_TIMESTAMP),
('cardapio-chivas-12', 'Chivas 12 anos', 'whisky', 2800, '/assets/cardapio/chivas-12.jpg', 2, CURRENT_TIMESTAMP),
('cardapio-red-label', 'Red Label', 'whisky', 1800, '/assets/cardapio/red-label.jpg', 3, CURRENT_TIMESTAMP),
('cardapio-black-label', 'Black Label', 'whisky', 2200, '/assets/cardapio/black-label.jpg', 4, CURRENT_TIMESTAMP),
('cardapio-coca-cola', 'Coca-Cola', 'sem_alcool', 800, '/assets/cardapio/coca-cola.jpg', 1, CURRENT_TIMESTAMP),
('cardapio-coca-zero', 'Coca Zero', 'sem_alcool', 800, '/assets/cardapio/coca-zero.jpg', 2, CURRENT_TIMESTAMP),
('cardapio-guarana', 'Guaraná', 'sem_alcool', 800, '/assets/cardapio/guarana.jpg', 3, CURRENT_TIMESTAMP),
('cardapio-red-bull', 'Red Bull', 'sem_alcool', 1400, '/assets/cardapio/red-bull.jpg', 4, CURRENT_TIMESTAMP),
('cardapio-agua-sem-gas', 'Água sem gás', 'sem_alcool', 500, '/assets/cardapio/agua-sem-gas.jpg', 5, CURRENT_TIMESTAMP),
('cardapio-agua-com-gas', 'Água com gás', 'sem_alcool', 600, '/assets/cardapio/agua-com-gas.jpg', 6, CURRENT_TIMESTAMP),
('cardapio-suco-laranja', 'Suco de laranja', 'sem_alcool', 1000, '/assets/cardapio/suco-laranja.jpg', 7, CURRENT_TIMESTAMP);
