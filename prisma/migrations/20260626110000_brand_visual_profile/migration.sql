CREATE TABLE "BrandVisualProfile" (
  "id" TEXT NOT NULL,
  "palette" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "stileFotografico" TEXT,
  "mood" TEXT,
  "elementiRicorrenti" TEXT,
  "daEvitare" TEXT,
  "referenceImagePaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrandVisualProfile_pkey" PRIMARY KEY ("id")
);
