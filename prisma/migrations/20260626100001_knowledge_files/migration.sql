CREATE TYPE "KnowledgeFileKind" AS ENUM ('DOCUMENTO', 'IMMAGINE');
CREATE TYPE "FileStatus" AS ENUM ('IN_CORSO', 'PRONTO', 'ERRORE');
CREATE TABLE "KnowledgeFile" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "kind" "KnowledgeFileKind" NOT NULL,
  "testo" TEXT,
  "stato" "FileStatus" NOT NULL DEFAULT 'IN_CORSO',
  "errore" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeFile_pkey" PRIMARY KEY ("id")
);
