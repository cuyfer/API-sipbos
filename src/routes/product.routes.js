const express = require("express");
const prisma = require("../utils/prisma");
const { Prisma } = require("@prisma/client");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * GET
 * router for categories
 * responses: {}
 *
 **/
router.get("/product/categories", async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      include: {
        subcategories: true,
      },
    });

    if (!categories || categories.length === 0) {
      return res.status(404).json({ message: "Categories Not Found" });
    }

    return res.status(200).json({
      message: "Categories retrieved successfully",
      data: categories,
    });
  } catch (err) {
    console.error("Error Get Categories", err);
    return res.status(500).json({ message: "Categories Error..." });
  }
});

/**
 * POST
 * router for post categories
 * responses: {}
 **/

router.post("/product/categories/post", async (req, res) => {
  try {
    const { name, icon, color, image, subcategories } = req.body; // product_count diabaikan

    if (!name || !icon || !color || !image) {
      return res
        .status(400)
        .json({ message: "name, icon, color, image required" });
    }

    let subcatsData;
    if (Array.isArray(subcategories) && subcategories.length > 0) {
      subcatsData = {
        create: subcategories.map((sc) => ({
          name: sc.name,
          image: sc.image,
          // product_count diabaikan; default 0 dari DB
        })),
      };
    }

    const created = await prisma.categories.create({
      data: {
        name,
        icon,
        color,
        image,
        // product_count diabaikan; default 0 dari DB
        ...(subcatsData ? { subcategories: subcatsData } : {}),
      },
      include: { subcategories: true },
    });

    return res.status(201).json({
      message: "Category created",
      data: created,
    });
  } catch (err) {
    console.error("Error Create Category", err);
    return res.status(500).json({ message: "Failed to create category" });
  }
});

// Guard role seller (cek role dari DB)
async function requireSeller(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    if (!user || user.role !== "seller") {
      return res
        .status(403)
        .json({ message: "Forbidden: seller role required" });
    }
    return next();
  } catch (e) {
    return res.status(500).json({ message: "Role check error" });
  }
}

/**
 * Helper: find taxonomy by name (category first, then subcategory)
 * Returns: { type: 'category'|'subcategory', id: string, parentCategoryId?: string }
 */
async function findTaxonomyByName(name) {
  const category = await prisma.categories.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (category) return { type: "category", id: category.id };

  const subcategory = await prisma.subcategories.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, categoryId: true },
  });
  if (subcategory)
    return {
      type: "subcategory",
      id: subcategory.id,
      parentCategoryId: subcategory.categoryId,
    };

  return null;
}

/**
 * Helper: recompute category.product_count = direct products in category + sum(subcategories.product_count)
 */
async function recomputeCategoryCount(tx, categoryId) {
  const [subAgg, directCount] = await Promise.all([
    tx.subcategories.aggregate({
      where: { categoryId },
      _sum: { product_count: true },
    }),
    tx.productSeller.count({ where: { categoryId } }),
  ]);
  const subSum = subAgg._sum.product_count || 0;
  const total = subSum + directCount;
  await tx.categories.update({
    where: { id: categoryId },
    data: { product_count: total },
  });
}

/**
 * CREATE product by seller
 * Body: { name, image?, description?, categoryName }
 * - Mencari ke Categories.name dulu; jika tidak ada, ke Subcategories.name
 */
router.post("/product", authMiddleware, requireSeller, async (req, res) => {
  try {
    const {
      name,
      description,
      sku,
      price,
      discountPercent,
      categoryId,
      subcategoryId,
      categoryName, // optional alternative lookup
      subcategory, // optional alternative lookup
      images = [],
      weightGram,
      packaging,
      expiresAt,
      storageInstructions,
      stock,
      minOrder,
      maxOrder,
      flavors = [],
      ingredients = [],
      tags = [],
    } = req.body;

    if (!name) return res.status(400).json({ message: "name is required" });
    if (price !== undefined && Number(price) < 0)
      return res.status(400).json({ message: "price must be >= 0" });
    if (discountPercent !== undefined) {
      const d = Number(discountPercent);
      if (d < 0 || d > 100) return res.status(400).json({ message: "discountPercent must be 0..100" });
    }
    if (minOrder !== undefined && Number(minOrder) < 1)
      return res.status(400).json({ message: "minOrder must be >= 1" });
    if (maxOrder !== undefined && minOrder !== undefined && Number(maxOrder) < Number(minOrder))
      return res.status(400).json({ message: "maxOrder must be >= minOrder" });
    if (weightGram !== undefined && Number(weightGram) < 0)
      return res.status(400).json({ message: "weightGram must be >= 0" });

    if (price !== undefined) {
      const p = Number(price);
      if (p >= 1e8) return res.status(400).json({ message: "price must be < 100,000,000" });
    }
    

    const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user.id } });
    if (!seller) return res.status(403).json({ message: "Seller profile not found" });

    let resolvedCategoryId = categoryId;
    let resolvedSubcategoryId = subcategoryId;

    if (categoryName && (!resolvedCategoryId && !resolvedSubcategoryId)) {
    const taxonomy = await findTaxonomyByName(categoryName);
      if (!taxonomy) return res.status(400).json({ message: "Category/Subcategory not found" });
      if (taxonomy.type === "category") resolvedCategoryId = taxonomy.id;
      else resolvedSubcategoryId = taxonomy.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.productSeller.create({
        data: {
          name,
          description,
          sku: sku ?? undefined,
          price: price !== undefined ? new Prisma.Decimal(price) : undefined,
          discountPercent: discountPercent !== undefined ? Number(discountPercent) : undefined,
          categoryId: resolvedCategoryId ?? undefined,
          // subcategoryId: resolvedSubcategoryId ?? undefined ?? subcategory,
          subcategoryId: resolvedSubcategoryId ?? undefined,
          // subcategoryId: subcategory ?? undefined,
          sellerProfileId: seller.id,
          images: Array.isArray(images) ? images : [],
          weightGram: weightGram !== undefined ? Number(weightGram) : undefined,
          packaging: packaging ?? undefined,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          storageInstructions: storageInstructions ?? undefined,
          stock: stock !== undefined ? Number(stock) : undefined,
          minOrder: minOrder !== undefined ? Number(minOrder) : undefined,
          maxOrder: maxOrder !== undefined ? Number(maxOrder) : undefined,
          flavors: Array.isArray(flavors) ? flavors : [],
          ingredients: Array.isArray(ingredients) ? ingredients : [],
          tags: Array.isArray(tags) ? tags : [],
        },
      });

      if (resolvedCategoryId) {
        await recomputeCategoryCount(tx, resolvedCategoryId);
      } else if (resolvedSubcategoryId) {
        const updatedSub = await tx.subcategories.update({
          where: { id: resolvedSubcategoryId },
          data: { product_count: { increment: 1 } },
        });
        await recomputeCategoryCount(tx, updatedSub.categoryId);
      }

      return created;
    });

    return res.status(201).json({ message: "Product created", data: result });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'Duplicate unique field (e.g., sku)' });
    }
    console.error("Create product (full) error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * UPDATE product (name/image/description/categoryName)
 * - If taxonomy changes, adjust product_count for old and new taxonomy (category or subcategory)
 */
router.put("/product/:id", authMiddleware, requireSeller, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image, description, categoryName } = req.body;

    // Verify product ownership
    const existing = await prisma.productSeller.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ message: "Product not found" });

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!seller || existing.sellerProfileId !== seller.id) {
      return res.status(403).json({ message: "Not your product" });
    }

    let newTaxonomy = null;
    if (categoryName) {
      newTaxonomy = await findTaxonomyByName(categoryName);
      if (!newTaxonomy) {
        return res
          .status(400)
          .json({ message: "Category/Subcategory not found" });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // adjust counters if taxonomy changed
      if (newTaxonomy) {
        const oldIsCategory = !!existing.categoryId;
        const oldId = existing.categoryId || existing.subcategoryId;

        if (oldIsCategory) {
          // Moved from category
          if (newTaxonomy.type === "category") {
            if (newTaxonomy.id !== oldId) {
              // recompute both old and new categories
              await recomputeCategoryCount(tx, oldId);
              await recomputeCategoryCount(tx, newTaxonomy.id);
            }
          } else {
            // to subcategory: decrement old category by recompute, increment subcategory, recompute parent
            await recomputeCategoryCount(tx, oldId);
            await tx.subcategories.update({
              where: { id: newTaxonomy.id },
              data: { product_count: { increment: 1 } },
            });
            await recomputeCategoryCount(tx, newTaxonomy.parentCategoryId);
          }
        } else {
          // old is subcategory
          if (newTaxonomy.type === "category") {
            // decrement old subcategory, recompute its parent category; then recompute new category (direct count)
            if (oldId) {
              const oldSub = await tx.subcategories.update({
                where: { id: oldId },
                data: { product_count: { decrement: 1 } },
              });
              await recomputeCategoryCount(tx, oldSub.categoryId);
            }
            await recomputeCategoryCount(tx, newTaxonomy.id);
          } else {
            // subcategory -> subcategory
            if (newTaxonomy.id !== oldId) {
              // decrement old subcategory and recompute its parent
              if (oldId) {
                const oldSub = await tx.subcategories.update({
                  where: { id: oldId },
                  data: { product_count: { decrement: 1 } },
                });
                await recomputeCategoryCount(tx, oldSub.categoryId);
              }
              // increment new and recompute parent
              await tx.subcategories.update({
                where: { id: newTaxonomy.id },
                data: { product_count: { increment: 1 } },
              });
              await recomputeCategoryCount(tx, newTaxonomy.parentCategoryId);
            }
          }
        }
      }

      return tx.productSeller.update({
        where: { id },
        data: {
          name: name ?? undefined,
          image: image ?? undefined,
          description: description ?? undefined,
          categoryId: newTaxonomy
            ? newTaxonomy.type === "category"
              ? newTaxonomy.id
              : null
            : undefined,
          subcategoryId: newTaxonomy
            ? newTaxonomy.type === "subcategory"
              ? newTaxonomy.id
              : null
            : undefined,
        },
      });
    });

    return res.json({ message: "Product updated", data: updated });
  } catch (err) {
    console.error("Update product error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE product
 * - Decrement product_count in category or subcategory
 */
router.delete(
  "/product/:id",
  authMiddleware,
  requireSeller,
  async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await prisma.productSeller.findUnique({ where: { id } });
      if (!existing)
        return res.status(404).json({ message: "Product not found" });

      const seller = await prisma.sellerProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!seller || existing.sellerProfileId !== seller.id) {
        return res.status(403).json({ message: "Not your product" });
      }

      await prisma.$transaction(async (tx) => {
        await tx.productSeller.delete({ where: { id } });
        if (existing.categoryId) {
          // Direct under category: just recompute the category total
          await recomputeCategoryCount(tx, existing.categoryId);
        } else if (existing.subcategoryId) {
          const oldSub = await tx.subcategories.update({
            where: { id: existing.subcategoryId },
            data: { product_count: { decrement: 1 } },
          });
          await recomputeCategoryCount(tx, oldSub.categoryId);
        }
      });

      return res.json({ message: "Product deleted" });
    } catch (err) {
      console.error("Delete product error", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PUBLIC: List products for users
 * GET /products
 * Query: page, pageSize, q, categoryId, subcategoryId, hasStock=true|false, sort=createdAt|price|likes|rating & order=asc|desc
 */
router.get('/products', async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const q = (req.query.q || '').toString().trim();
    const categoryId = req.query.categoryId ? req.query.categoryId.toString() : undefined;
    const subcategoryId = req.query.subcategoryId ? req.query.subcategoryId.toString() : undefined;
    const hasStock = req.query.hasStock ? req.query.hasStock.toString() === 'true' : undefined;
    const sort = (req.query.sort || 'createdAt').toString();
    const order = (req.query.order || 'desc').toString();

    const sortMap = {
      createdAt: 'createdAt',
      price: 'price',
      likes: 'likesCount',
      rating: 'averageRating',
    };
    const orderByField = sortMap[sort] || 'createdAt';
    const orderByDir = order === 'asc' ? 'asc' : 'desc';

    const where = {
      ...(q ? { OR: [ { name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } } ] } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(subcategoryId ? { subcategoryId } : {}),
      ...(hasStock !== undefined ? { stock: hasStock ? { gt: 0 } : undefined } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.productSeller.count({ where }),
      prisma.productSeller.findMany({
        where,
        orderBy: { [orderByField]: orderByDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          price: true,
          discountPercent: true,
          images: true,
          likesCount: true,
          averageRating: true,
          ratingCount: true,
          stock: true,
          category: true,
          subcategory: true,
        },
      }),
    ]);

    return res.json({
      message: 'Products retrieved',
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error('Public list products error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUBLIC: Get product detail for users
 * GET /products/:id
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.productSeller.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        sku: true,
        price: true,
        discountPercent: true,
        images: true,
        flavors: true,
        ingredients: true,
        tags: true,
        weightGram: true,
        packaging: true,
        expiresAt: true,
        storageInstructions: true,
        stock: true,
        minOrder: true,
        maxOrder: true,
        likesCount: true,
        averageRating: true,
        ratingCount: true,
        category: true,
        subcategory: true,
        createdAt: true,
      }
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json({ message: 'Product detail', data: product });
  } catch (err) {
    console.error('Public product detail error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});
/**
 * Upload Product
 * POST
 * responses = {}
 *
 */
router.post(
  "/upload/product",
  authMiddleware,
  requireSeller,
  async (req, res) => {
    const { name, image, description, sellerProfileId, sellerProfile } = req.body
   

  }
);


/**
 * GET Products
 * GET
 * responses = {}
 */

router.get('/get/product/', authMiddleware, requireSeller, async (req, res)=>{
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const q = (req.query.q || '').toString().trim();
    const categoryId = req.query.categoryId ? req.query.categoryId.toString() : undefined;
    const subcategoryId = req.query.subcategoryId ? req.query.subcategoryId.toString() : undefined;

    const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user.id } });
    if (!seller) return res.status(403).json({ message: 'Seller profile not found' });

    const where = {
      sellerProfileId: seller.id,
      ...(q ? { OR: [ { name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } } ] } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(subcategoryId ? { subcategoryId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.productSeller.count({ where }),
      prisma.productSeller.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          subcategory: true,
        },
      }),
    ]);

    return res.json({
      message: 'Products retrieved',
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error('List products error', err);
    return res.status(500).json({ message: 'Server error' });
  }
})

// GET product detail by id (scoped to current seller)
router.get('/product/:id', authMiddleware, requireSeller, async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user.id } });
    if (!seller) return res.status(403).json({ message: 'Seller profile not found' });

    const product = await prisma.productSeller.findFirst({
      where: { id, sellerProfileId: seller.id },
      include: { category: true, subcategory: true },
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.json({ message: 'Product detail', data: product });
  } catch (err) {
    console.error('Get product detail error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get Produk terpilih
 * get
 * responses = {}
 */
router.get('/get/favorit/products', async (req, res)=>{
  
})
/**
 * Get produk UMKM terpilih
 * get
 * responses = {}
 */
router.get('/get/favorit/products', async (req, res)=>{

})

/**
 * LIKE product (idempotent)
 * POST /product/:id/like
 */
router.post("/product/:id/like", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.productSeller.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.productLike.findUnique({
          where: { userId_productId: { userId, productId: id } },
        });
        if (existing) {
          const fresh = await tx.productSeller.findUnique({
            where: { id },
            select: { likesCount: true },
          });
          return { liked: true, likesCount: fresh?.likesCount ?? product.likesCount };
        }

        await tx.productLike.create({ data: { userId, productId: id } });
        const updated = await tx.productSeller.update({
          where: { id },
          data: { likesCount: { increment: 1 } },
          select: { likesCount: true },
        });
        return { liked: true, likesCount: updated.likesCount };
      });
      return res.status(200).json({ message: "Liked", ...result });
    } catch (e) {
      const fresh = await prisma.productSeller.findUnique({
        where: { id },
        select: { likesCount: true },
      });
      return res.status(200).json({ message: "Liked", liked: true, likesCount: fresh?.likesCount ?? product.likesCount });
    }
  } catch (err) {
    console.error("Like product error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * UNLIKE product (idempotent)
 * DELETE /product/:id/like
 */
router.delete("/product/:id/like", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.productSeller.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.productLike.findUnique({
        where: { userId_productId: { userId, productId: id } },
      });
      if (!existing) {
        const fresh = await tx.productSeller.findUnique({
          where: { id },
          select: { likesCount: true },
        });
        return { liked: false, likesCount: fresh?.likesCount ?? product.likesCount };
      }

      await tx.productLike.delete({ where: { id: existing.id } });
      const updated = await tx.productSeller.update({
        where: { id },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
      if ((updated.likesCount ?? 0) < 0) {
        const corrected = await tx.productSeller.update({
          where: { id },
          data: { likesCount: 0 },
          select: { likesCount: true },
        });
        return { liked: false, likesCount: corrected.likesCount };
      }
      return { liked: false, likesCount: updated.likesCount };
    });

    return res.status(200).json({ message: "Unliked", ...result });
  } catch (err) {
    console.error("Unlike product error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
