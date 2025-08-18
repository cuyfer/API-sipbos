const express = require("express");
const prisma = require("../utils/prisma");
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
                subcategories: true
            }
        });
        
        if (!categories || categories.length === 0) {
            return res.status(404).json({ message: "Categories Not Found" });
        }
        
        return res.status(200).json({
            message: "Categories retrieved successfully",
            data: categories
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

router.post('/product/categories/post', async (req, res) => {
    try {
        const { name, icon, color, image, subcategories } = req.body; // product_count diabaikan

        if (!name || !icon || !color || !image) {
            return res.status(400).json({ message: "name, icon, color, image required" });
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
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
        if (!user || user.role !== 'seller') {
            return res.status(403).json({ message: 'Forbidden: seller role required' });
        }
        return next();
    } catch (e) {
        return res.status(500).json({ message: 'Role check error' });
    }
}

/**
 * Helper: find taxonomy by name (category first, then subcategory)
 * Returns: { type: 'category'|'subcategory', id: string, parentCategoryId?: string }
 */
async function findTaxonomyByName(name) {
    const category = await prisma.categories.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true }
    });
    if (category) return { type: 'category', id: category.id };

    const subcategory = await prisma.subcategories.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, categoryId: true }
    });
    if (subcategory) return { type: 'subcategory', id: subcategory.id, parentCategoryId: subcategory.categoryId };

    return null;
}

/**
 * Helper: recompute category.product_count = direct products in category + sum(subcategories.product_count)
 */
async function recomputeCategoryCount(tx, categoryId) {
    const [subAgg, directCount] = await Promise.all([
        tx.subcategories.aggregate({
            where: { categoryId },
            _sum: { product_count: true }
        }),
        tx.productSeller.count({ where: { categoryId } })
    ]);
    const subSum = subAgg._sum.product_count || 0;
    const total = subSum + directCount;
    await tx.categories.update({ where: { id: categoryId }, data: { product_count: total } });
}

/**
 * CREATE product by seller
 * Body: { name, image?, description?, categoryName }
 * - Mencari ke Categories.name dulu; jika tidak ada, ke Subcategories.name
 */
router.post('/product', authMiddleware, requireSeller, async (req, res) => {
    try {
        const { name, image, description, categoryName } = req.body;
        if (!name || !categoryName) {
            return res.status(400).json({ message: 'name and categoryName are required' });
        }

        // Find sellerProfile of current user
        const seller = await prisma.sellerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!seller) {
            return res.status(403).json({ message: 'Seller profile not found' });
        }

        // Find taxonomy by name
        const taxonomy = await findTaxonomyByName(categoryName);
        if (!taxonomy) {
            return res.status(400).json({ message: 'Category/Subcategory not found' });
        }

        // Create product and adjust counters atomically
        const result = await prisma.$transaction(async (tx) => {
            const created = await tx.productSeller.create({
                data: {
                    name,
                    image,
                    description,
                    categoryId: taxonomy.type === 'category' ? taxonomy.id : undefined,
                    subcategoryId: taxonomy.type === 'subcategory' ? taxonomy.id : undefined,
                    sellerProfileId: seller.id,
                }
            });

            if (taxonomy.type === 'category') {
                // Direct product under category: recompute total to include direct products + subcategories
                await recomputeCategoryCount(tx, taxonomy.id);
            } else {
                // Increment subcategory then recompute its parent category
                await tx.subcategories.update({
                    where: { id: taxonomy.id },
                    data: { product_count: { increment: 1 } }
                });
                await recomputeCategoryCount(tx, taxonomy.parentCategoryId);
            }

            return created;
        });

        return res.status(201).json({ message: 'Product created', data: result });
    } catch (err) {
        console.error('Create product error', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

/**
 * UPDATE product (name/image/description/categoryName)
 * - If taxonomy changes, adjust product_count for old and new taxonomy (category or subcategory)
 */
router.put('/product/:id', authMiddleware, requireSeller, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, image, description, categoryName } = req.body;

        // Verify product ownership
        const existing = await prisma.productSeller.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Product not found' });

        const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user.id } });
        if (!seller || existing.sellerProfileId !== seller.id) {
            return res.status(403).json({ message: 'Not your product' });
        }

        let newTaxonomy = null;
        if (categoryName) {
            newTaxonomy = await findTaxonomyByName(categoryName);
            if (!newTaxonomy) {
                return res.status(400).json({ message: 'Category/Subcategory not found' });
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            // adjust counters if taxonomy changed
            if (newTaxonomy) {
                const oldIsCategory = !!existing.categoryId;
                const oldId = existing.categoryId || existing.subcategoryId;

                if (oldIsCategory) {
                    // Moved from category
                    if (newTaxonomy.type === 'category') {
                        if (newTaxonomy.id !== oldId) {
                            // recompute both old and new categories
                            await recomputeCategoryCount(tx, oldId);
                            await recomputeCategoryCount(tx, newTaxonomy.id);
                        }
                    } else {
                        // to subcategory: decrement old category by recompute, increment subcategory, recompute parent
                        await recomputeCategoryCount(tx, oldId);
                        await tx.subcategories.update({ where: { id: newTaxonomy.id }, data: { product_count: { increment: 1 } } });
                        await recomputeCategoryCount(tx, newTaxonomy.parentCategoryId);
                    }
                } else {
                    // old is subcategory
                    if (newTaxonomy.type === 'category') {
                        // decrement old subcategory, recompute its parent category; then recompute new category (direct count)
                        if (oldId) {
                            const oldSub = await tx.subcategories.update({ where: { id: oldId }, data: { product_count: { decrement: 1 } } });
                            await recomputeCategoryCount(tx, oldSub.categoryId);
                        }
                        await recomputeCategoryCount(tx, newTaxonomy.id);
                    } else {
                        // subcategory -> subcategory
                        if (newTaxonomy.id !== oldId) {
                            // decrement old subcategory and recompute its parent
                            if (oldId) {
                                const oldSub = await tx.subcategories.update({ where: { id: oldId }, data: { product_count: { decrement: 1 } } });
                                await recomputeCategoryCount(tx, oldSub.categoryId);
                            }
                            // increment new and recompute parent
                            await tx.subcategories.update({ where: { id: newTaxonomy.id }, data: { product_count: { increment: 1 } } });
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
                    categoryId: newTaxonomy ? (newTaxonomy.type === 'category' ? newTaxonomy.id : null) : undefined,
                    subcategoryId: newTaxonomy ? (newTaxonomy.type === 'subcategory' ? newTaxonomy.id : null) : undefined,
                }
            });
        });

        return res.json({ message: 'Product updated', data: updated });
    } catch (err) {
        console.error('Update product error', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

/**
 * DELETE product
 * - Decrement product_count in category or subcategory
 */
router.delete('/product/:id', authMiddleware, requireSeller, async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.productSeller.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Product not found' });

        const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user.id } });
        if (!seller || existing.sellerProfileId !== seller.id) {
            return res.status(403).json({ message: 'Not your product' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.productSeller.delete({ where: { id } });
            if (existing.categoryId) {
                // Direct under category: just recompute the category total
                await recomputeCategoryCount(tx, existing.categoryId);
            } else if (existing.subcategoryId) {
                const oldSub = await tx.subcategories.update({ where: { id: existing.subcategoryId }, data: { product_count: { decrement: 1 } } });
                await recomputeCategoryCount(tx, oldSub.categoryId);
            }
        });

        return res.json({ message: 'Product deleted' });
    } catch (err) {
        console.error('Delete product error', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;