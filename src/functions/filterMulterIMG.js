const multer = require("multer");

const fileFilter = (req, file, cb) => {
  const allowedType = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

  if (allowedType.includes(file.mimetype)) {
    cb(null, true); // diterima
  } else {
    cb(new Error("Only file PNG, JPEG, JPG, dan WEBP "), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter,
});

module.exports = {
  fileFilter,
  upload,
};
