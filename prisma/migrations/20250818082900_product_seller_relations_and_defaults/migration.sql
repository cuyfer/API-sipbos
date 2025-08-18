/*
  Warnings:

  - Made the column `product_count` on table `Categories` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Categories" ALTER COLUMN "product_count" SET NOT NULL,
ALTER COLUMN "product_count" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."ProductSeller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSeller_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ProductSeller" ADD CONSTRAINT "ProductSeller_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductSeller" ADD CONSTRAINT "ProductSeller_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "public"."SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
