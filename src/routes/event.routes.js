const express = require("express");
const prisma = require("../utils/prisma");
const { Prisma } = require("@prisma/client");
const authMiddleware = require("../middlewares/authMiddleware");
const authMiddlewareGetProductsLikes = require("../middlewares/authMiddlewareGetProductsLikes");
// const supabase = require("../config/supabase");
const multer = require("multer");
const { storage } = require("../config/appwrite");
const { fileFilter, upload } = require("../functions/filterMulterIMG");

// express().use(express.json());
// express().use(express.urlencoded({ extended: true }));

const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage() });

/**
 *
 * Post a Banner
 * POST /event/banner/post
 *
 */
router.post(
  "/event/banner/post",
  // authMiddleware,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const { title, description } = req.body;
      const images = req.files;

      if (!title || !description || !images || !images.length) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      let imgUrls = [];

      for (const image of images) {
        const fileName = `${Date.now()}-${image.originalname}`;

        const result = await storage.createFile(
          process.env.APPWRITE_BUCKET_ID,
          "unique()",
          new File([image.buffer], fileName, { type: image.mimetype })
        );

        const fileId = result.$id;

        const fileUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${fileId}/view?project=${process.env.APPWRITE_PROJECT_ID}&mode=admin`;
        imgUrls.push(fileUrl);
      }

      const newBanner = await prisma.banner.create({
        data: {
          title,
          description,
          images: imgUrls,
        },
      });

      res.status(201).json({
        message: "Banner uploaded successfully",
        data: newBanner,
      });
    } catch (error) {
      console.error("Unexpected Error", error);
      return res.status(500).json({ message: "Unexpected Error", data: null });
    }
  }
);

/**
 *
 * Get Data Banner
 * GET /event/banner/
 */

router.get("/event/banner", async (req, res) => {
  try {
    const bannerDatas = await prisma.banner.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        images: true,
      },
    });

    if (!bannerDatas) {
      console.log("Failed get data Banner! " + bannerDatas);
      return res.status(501).json({ message: "Failed Get Data!" });
    }

    return res
      .status(200)
      .json({ message: "Successfully get data banner!", data: bannerDatas });
  } catch (error) {
    console.log("Unexpected Error" + error);
    return res.status(500).json({ message: "Unexpected Error", data: null });
  }
});

module.exports = router;
