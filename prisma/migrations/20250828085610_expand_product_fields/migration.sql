/*
  Warnings:

  - You are about to drop the column `ratting` on the `ProductSeller` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sku]` on the table `ProductSeller` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."ProductSeller" DROP COLUMN "ratting",
ADD COLUMN     "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "flavors" TEXT[],
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "ingredients" TEXT[],
ADD COLUMN     "maxOrder" INTEGER,
ADD COLUMN     "minOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "packaging" TEXT,
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageInstructions" TEXT,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "weightGram" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "ProductSeller_sku_key" ON "public"."ProductSeller"("sku");
