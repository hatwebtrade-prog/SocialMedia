-- DropIndex
DROP INDEX "Idea_status_idx";

-- CreateIndex
CREATE INDEX "GenerationRun_sourceId_idx" ON "GenerationRun"("sourceId");

-- CreateIndex
CREATE INDEX "Idea_status_category_idx" ON "Idea"("status", "category");

-- CreateIndex
CREATE INDEX "Idea_sourceId_idx" ON "Idea"("sourceId");

-- CreateIndex
CREATE INDEX "Idea_productId_idx" ON "Idea"("productId");
