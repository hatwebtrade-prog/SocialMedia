-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('NUOVA', 'INTERESSANTE', 'APPROVATA', 'SCARTATA', 'DA_APPROFONDIRE');

-- CreateEnum
CREATE TYPE "IdeaCategory" AS ENUM ('INTEGRATORI', 'BEAUTY', 'BENESSERE', 'STAGIONALITA', 'EDUCATIONAL', 'VENDITA', 'FAQ', 'TREND');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'BLOG');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('AI', 'MANUALE', 'API');

-- CreateEnum
CREATE TYPE "KnowledgeType" AS ENUM ('INFO_PRODOTTO', 'BRAND_VOICE', 'TARGET', 'CLAIM', 'LINEA_GUIDA', 'DOCUMENTO');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'DONE', 'ERROR');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "descrizione" TEXT,
    "benefici" TEXT,
    "ingredienti" TEXT,
    "target" TEXT,
    "url" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "tipo" "KnowledgeType" NOT NULL,
    "titolo" TEXT NOT NULL,
    "contenuto" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "SourceType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "abilitata" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "promptUsato" TEXT NOT NULL DEFAULT '',
    "outputGrezzo" JSONB NOT NULL DEFAULT '{}',
    "modello" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "errore" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL DEFAULT '',
    "category" "IdeaCategory" NOT NULL,
    "piattaformeConsigliate" "Platform"[] DEFAULT ARRAY[]::"Platform"[],
    "seoScore" INTEGER NOT NULL DEFAULT 3,
    "viralityScore" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "IdeaStatus" NOT NULL DEFAULT 'NUOVA',
    "note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productId" TEXT,
    "sourceId" TEXT NOT NULL,
    "generationRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalSource_key_key" ON "SignalSource"("key");

-- CreateIndex
CREATE INDEX "Idea_status_idx" ON "Idea"("status");

-- CreateIndex
CREATE INDEX "Idea_category_idx" ON "Idea"("category");

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SignalSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SignalSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
