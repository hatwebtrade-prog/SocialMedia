-- Soft-delete flag for ideas (cestino)
ALTER TABLE "Idea" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Idea_deletedAt_idx" ON "Idea"("deletedAt");
