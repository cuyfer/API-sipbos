const express = require("express");
const prisma = require("../utils/prisma");
const { Prisma } = require("@prisma/client");
const authMiddleware = require("../middlewares/authMiddleware");
const authMiddlewareGetProductsLikes = require("../middlewares/authMiddlewareGetProductsLikes");
// const supabase = require("../config/supabase");
const multer = require("multer");

// express().use(express.json());
// express().use(express.urlencoded({ extended: true }));

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 *
 * Post a Banner
 * POST /event/banner/post
 *
 */
// router.post( // ini route resmi dari banne
//   "/event/banner/post",
//   // authMiddleware,
//   upload.array("files", 5),
//   async (req, res) => {
//     try {
//       const { title, description} = req.body;
//       const files = req.files;

//       if (!title || !description || !files || !files.length) {
//         return res.status(400).json({ message: "Missing required fields" });
//       }

//       let imgUrls = [];

//       for (const file of files) {
//         const fileName = `${Date.now()}-${file.originalname}`;
//         const filePath = `banner/${fileName}`;
//         const { error } = await supabase.storage
//           .from("image_event")
//           .upload(filePath, file.buffer, {
//             contentType: file.mimetype,
//           });

//         if (error) {
//           console.error(error);
//           return res.status(500).json({ message: "Upload to Supabase failed" });
//         }

//         const { data } = supabase.storage
//           .from("image_event")
//           .getPublicUrl(filePath);

//         imgUrls.push(data.publicUrl);
//         // imgUrls.push(file)
//       }

//       const newProduct = await prisma.Banner.create({
//         data: {
//           title,
//           description,
//           images: imgUrls,
//         },
//       });

//       res.status(201).json({
//         message: "Product uploaded successfully",
//         data: newProduct,
//       });
//     } catch (error) {
//       console.log("Unexpected Error " + error);
//       return res.status(500).json({ message: "Unexpected Error", data: null });
//     }
//   }
// );
router.post("/event/banner/post", // ini route sementara dari banner pakai string bukan file
  async (req, res) => {
    try {
      const { title, description, images } = req.body;

      if (!title || !description || !images || !images.length) {
        console.log('error')
        return res.status(400).json({ message: "Missing required fields" });
      }

      const newBanner = await prisma.Banner.create({
        data: {
          title,
          description,
          images,
        },
      });

      res.status(201).json({
        message: "Banner uploaded successfully",
        data: newBanner,
      });
    } catch (error) {
      console.error("Unexpected Error:", error);
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
