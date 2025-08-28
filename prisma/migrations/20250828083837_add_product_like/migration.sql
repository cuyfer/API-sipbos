/*
  Warnings:

  - Added the required column `ratting` to the `ProductSeller` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ProductSeller" ADD COLUMN     "likesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratting" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "public"."ProductLike" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductLike_productId_idx" ON "public"."ProductLike"("productId");

-- CreateIndex
CREATE INDEX "ProductLike_userId_idx" ON "public"."ProductLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLike_userId_productId_key" ON "public"."ProductLike"("userId", "productId");

-- AddForeignKey
ALTER TABLE "public"."ProductLike" ADD CONSTRAINT "ProductLike_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."ProductSeller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductLike" ADD CONSTRAINT "ProductLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
