ALTER TABLE "GeneratedContent" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "GeneratedContent_deletedAt_idx" ON "GeneratedContent"("deletedAt");
