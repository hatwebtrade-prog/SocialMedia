-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('NON_INVIATO', 'INVIATO_A_N8N', 'IN_PUBBLICAZIONE', 'PUBBLICATO', 'ERRORE');

-- AlterTable
ALTER TABLE "GeneratedContent" ADD COLUMN     "publicationError" TEXT,
ADD COLUMN     "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'NON_INVIATO',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "shopifyArticleId" TEXT,
ADD COLUMN     "shopifyArticleUrl" TEXT;
