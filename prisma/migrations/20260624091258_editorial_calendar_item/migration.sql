-- CreateTable
CREATE TABLE "EditorialCalendarItem" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "channel" "Canale" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialCalendarItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EditorialCalendarItem_contentId_key" ON "EditorialCalendarItem"("contentId");

-- CreateIndex
CREATE INDEX "EditorialCalendarItem_scheduledAt_idx" ON "EditorialCalendarItem"("scheduledAt");

-- CreateIndex
CREATE INDEX "EditorialCalendarItem_channel_idx" ON "EditorialCalendarItem"("channel");

-- AddForeignKey
ALTER TABLE "EditorialCalendarItem" ADD CONSTRAINT "EditorialCalendarItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "GeneratedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
