/*
  Warnings:

  - You are about to drop the `ProductTaxonomy` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ProductTaxonomy" DROP CONSTRAINT "ProductTaxonomy_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductTaxonomy" DROP CONSTRAINT "ProductTaxonomy_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductTaxonomy" DROP CONSTRAINT "ProductTaxonomy_subcategoryId_fkey";

-- DropTable
DROP TABLE "public"."ProductTaxonomy";

-- CreateTable
CREATE TABLE "public"."Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT[],

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);
