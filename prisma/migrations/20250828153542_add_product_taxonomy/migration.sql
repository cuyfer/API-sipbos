-- CreateTable
CREATE TABLE "public"."ProductTaxonomy" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,

    CONSTRAINT "ProductTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductTaxonomy_productId_idx" ON "public"."ProductTaxonomy"("productId");

-- CreateIndex
CREATE INDEX "ProductTaxonomy_categoryId_idx" ON "public"."ProductTaxonomy"("categoryId");

-- CreateIndex
CREATE INDEX "ProductTaxonomy_subcategoryId_idx" ON "public"."ProductTaxonomy"("subcategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTaxonomy_productId_categoryId_key" ON "public"."ProductTaxonomy"("productId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTaxonomy_productId_subcategoryId_key" ON "public"."ProductTaxonomy"("productId", "subcategoryId");

-- AddForeignKey
ALTER TABLE "public"."ProductTaxonomy" ADD CONSTRAINT "ProductTaxonomy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."ProductSeller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTaxonomy" ADD CONSTRAINT "ProductTaxonomy_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTaxonomy" ADD CONSTRAINT "ProductTaxonomy_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
