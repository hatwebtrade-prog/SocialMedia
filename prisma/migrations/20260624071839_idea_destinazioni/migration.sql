-- CreateEnum
CREATE TYPE "Destinazione" AS ENUM ('META', 'BLOG', 'TIKTOK', 'EMAIL');

-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "destinazioni" "Destinazione"[] DEFAULT ARRAY[]::"Destinazione"[];
