/*
  Warnings:

  - Made the column `product_count` on table `Subcategories` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."ProductSeller" DROP CONSTRAINT "ProductSeller_categoryId_fkey";

-- AlterTable
ALTER TABLE "public"."ProductSeller" ADD COLUMN     "subcategoryId" TEXT,
ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Subcategories" ALTER COLUMN "product_count" SET NOT NULL,
ALTER COLUMN "product_count" SET DEFAULT 0;

-- AddForeignKey
ALTER TABLE "public"."ProductSeller" ADD CONSTRAINT "ProductSeller_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductSeller" ADD CONSTRAINT "ProductSeller_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
