-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "difficolta" INTEGER,
ADD COLUMN     "keyword" TEXT,
ADD COLUMN     "trendKeyword" TEXT,
ADD COLUMN     "volumeRicerca" INTEGER;

-- CreateIndex
CREATE INDEX "Idea_keyword_idx" ON "Idea"("keyword");
