const express = require('express')
const prisma = require('../utils/prisma')
const {Prisma} = require('@prisma/client')
const authMiddleware = require("../middlewares/authMiddleware");
const authMiddlewareGetProductsLikes = require("../middlewares/authMiddlewareGetProductsLikes");
const multer = require("multer");
const { storage } = require("../config/appwrite");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });


