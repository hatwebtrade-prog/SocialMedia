ALTER TABLE "Idea" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Idea_archivedAt_idx" ON "Idea"("archivedAt");
