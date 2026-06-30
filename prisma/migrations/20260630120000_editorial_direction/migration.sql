-- CreateTable
CREATE TABLE "EditorialDirection" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "campagna" TEXT,
    "periodo" TEXT,
    "temi" TEXT,
    "tonoVisivo" TEXT,
    "daMostrare" TEXT,
    "daEvitare" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EditorialDirection_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "KnowledgeFile" ADD COLUMN "knowledgeType" "KnowledgeType";
