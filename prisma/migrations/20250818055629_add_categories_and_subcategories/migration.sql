/*
  Warnings:

  - You are about to drop the column `address` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Profile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('buyer', 'seller');

-- AlterTable
ALTER TABLE "public"."Profile" DROP COLUMN "address",
DROP COLUMN "phone";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'buyer',
ALTER COLUMN "provider" SET DEFAULT 'manually';

-- CreateTable
CREATE TABLE "public"."BuyerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "shippingAddress" TEXT,

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SellerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopName" TEXT,
    "shopDescription" TEXT,
    "shopAddress" TEXT,
    "phoneNumber" TEXT,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "product_count" INTEGER,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subcategories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "product_count" INTEGER,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_userId_key" ON "public"."BuyerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "public"."SellerProfile"("userId");

-- AddForeignKey
ALTER TABLE "public"."BuyerProfile" ADD CONSTRAINT "BuyerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subcategories" ADD CONSTRAINT "Subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
