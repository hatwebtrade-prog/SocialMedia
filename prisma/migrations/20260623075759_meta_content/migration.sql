-- CreateEnum
CREATE TYPE "Canale" AS ENUM ('META', 'TIKTOK', 'BLOG');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('POST', 'CAROSELLO');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('BOZZA', 'DA_APPROVARE', 'APPROVATO', 'PROGRAMMATO', 'PUBBLICATO');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMMAGINE', 'VIDEO');

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "canale" "Canale" NOT NULL,
    "formato" "ContentFormat" NOT NULL,
    "piattaforme" "Platform"[] DEFAULT ARRAY[]::"Platform"[],
    "status" "ContentStatus" NOT NULL DEFAULT 'BOZZA',
    "dataPrevista" TIMESTAMP(3),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "promptUsato" TEXT NOT NULL DEFAULT '',
    "modello" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputGrezzo" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAsset" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "slideIndex" INTEGER,
    "tipo" "AssetType" NOT NULL DEFAULT 'IMMAGINE',
    "prompt" TEXT NOT NULL DEFAULT '',
    "modello" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedContent_status_idx" ON "GeneratedContent"("status");

-- CreateIndex
CREATE INDEX "GeneratedContent_canale_idx" ON "GeneratedContent"("canale");

-- CreateIndex
CREATE INDEX "GeneratedContent_dataPrevista_idx" ON "GeneratedContent"("dataPrevista");

-- CreateIndex
CREATE INDEX "GeneratedContent_ideaId_idx" ON "GeneratedContent"("ideaId");

-- CreateIndex
CREATE INDEX "GeneratedAsset_contentId_idx" ON "GeneratedAsset"("contentId");

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "GeneratedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
