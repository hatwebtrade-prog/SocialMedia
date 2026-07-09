-- AlterTable
ALTER TABLE "Product" ADD COLUMN "handle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_handle_key" ON "Product"("handle");
