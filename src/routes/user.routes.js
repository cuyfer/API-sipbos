const { InputFile } = require("node-appwrite");
const express = require("express");
const prisma = require("../utils/prisma");
const { Prisma } = require("@prisma/client");
const authMiddleware = require("../middlewares/authMiddleware");
const authMiddlewareGetProductsLikes = require("../middlewares/authMiddlewareGetProductsLikes");
const multer = require("multer");
const { storage } = require("../config/appwrite");
const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage() });
const { upload, fileFilter } = require("../functions/filterMulterIMG");
/**
 *
 * PUT update User
 * response  = { }
 * PUT
 */
router.put(
  "/user/profile/edit",
  upload.single("image"),
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, buyerProfile: true },
      });
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "buyer") {
        return res.status(403).json({ message: "Forbidden: Not a buyer" });
      }

      const { name, phoneNumber, shippingAddress } = req.body;

      // upload image kalau ada
      let imgUrl = user.profile?.image ?? null;
      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const result = await storage.createFile(
          process.env.APPWRITE_BUCKET_ID,
          "unique()",
          // Use req.file.buffer instead of image.buffer
          new File([req.file.buffer], fileName, { type: req.file.mimetype })
        );
        imgUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${result.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
      }

      const updated = await prisma.$transaction(async (tx) => {
        let profileUpdate = null;
        if (name || imgUrl) {
          profileUpdate = await tx.profile.upsert({
            where: { userId },
            update: { name, image: imgUrl },
            create: { userId, name, image: imgUrl },
          });
        }

        let buyerUpdate = null;
        if (phoneNumber || shippingAddress) {
          buyerUpdate = await tx.buyerProfile.upsert({
            where: { userId },
            update: { phoneNumber, shippingAddress },
            create: { userId, phoneNumber, shippingAddress },
          });
        }

        return { profile: profileUpdate, buyerProfile: buyerUpdate };
      });

      res.json({ message: "Buyer profile updated", data: updated });
    } catch (err) {
      console.error("Update buyer error", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 *
 * PUT update Seller
 * response  = { }
 * PUT
 */
// PUT update Seller
router.put(
  "/seller/profile/edit",
  upload.single("image"),
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, sellerProfile: true },
      });
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "seller") {
        return res.status(403).json({ message: "Forbidden: Not a seller" });
      }

      const { name, shopName, shopDescription, shopAddress, phoneNumber } =
        req.body;

      let imgUrl = user.profile?.image ?? null;
      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const result = await storage.createFile(
          process.env.APPWRITE_BUCKET_ID,
          "unique()",
          // Use req.file.buffer instead of image.buffer
          new File([req.file.buffer], fileName, { type: req.file.mimetype })
        );
        imgUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${result.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
      }

      const updated = await prisma.$transaction(async (tx) => {
        let profileUpdate = null;
        if (name || imgUrl) {
          profileUpdate = await tx.profile.upsert({
            where: { userId },
            update: { name, image: imgUrl },
            create: { userId, name, image: imgUrl },
          });
        }

        let sellerUpdate = null;
        if (shopName || shopDescription || shopAddress || phoneNumber) {
          sellerUpdate = await tx.sellerProfile.upsert({
            where: { userId },
            update: { shopName, shopDescription, shopAddress, phoneNumber },
            create: {
              userId,
              shopName,
              shopDescription,
              shopAddress,
              phoneNumber,
            },
          });
        }

        return { profile: profileUpdate, sellerProfile: sellerUpdate };
      });

      res.json({ message: "Seller profile updated", data: updated });
    } catch (err) {
      console.error("Update seller error", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET /auth/me
 * header: Authorization: Bearer <token>
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    delete user.password;
    return res.json({ user });
  } catch (err) {
    console.error("Me error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
