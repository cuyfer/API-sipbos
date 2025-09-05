const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");
const { generateToken } = require("../utils/jwt");
const authMiddleware = require("../middlewares/authMiddleware");
const { OAuth2Client } = require("google-auth-library");

const router = express.Router();
// express().use(express.json());
// express().use(express.urlencoded({ extended: true }));

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const buyer = "buyer";
const seller = "seller";

/**
 * For Buyer
 * POST /auth/register
 * body: { name?, email, password, phoneNumber }
 * Response: { message, token, user }
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email, password and phoneNumber are required" });
    }

    // check existing
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // create user + profile
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        provider: "manually",
        role: buyer,
        profile: {
          create: {
            name: name || "",
          },
        },
        buyerProfile: {
          create: {
            phoneNumber: phoneNumber,
          },
        },
      },
      include: { profile: true },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      provider: user.provider,
    });

    return res.status(201).json({
      message: "Registration successful",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          profile: user.profile,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("Register error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * For Seller
 * POST /auth/register
 * body: { name?, email, password, phoneNumber }
 * Response: { message, token, user }
 */

router.post("/register/sel", async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // check existing
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // create user + profile
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        provider: "manually",
        role: seller,
        profile: {
          create: {
            name: name || "",
          },
        },
        sellerProfile: {
          create: {
            phoneNumber: phoneNumber,
          },
        },
      },
      include: { profile: true },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      provider: user.provider,
    });

    return res.status(201).json({
      message: "Registration successful",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          profile: user.profile,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("Register error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * For Buyer
 * POST /auth/login
 * body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.password)
      return res.status(400).json({ message: "Please login with Google" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken({
      id: user.id,
      email: user.email,
      provider: user.provider,
    });

    return res.json({
      message: "Login successful",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          profile: user.profile,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("Login error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

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

/**
 * for buyer
 * GET /auth/google
 * header: Authorization: Bearer <token>
 */
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    if (!email)
      return res.status(400).json({ message: "email not found in token" });

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: sub }, { email }],
      },
      include: { profile: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId: sub,
          provider: "google",
          role: buyer,
          profile: {
            create: {
              name: name || "",
            },
          },
        },
        include: { profile: true },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: sub },
        include: { profile: true },
      });
    }

    const jwtToken = generateToken({
      id: user.id,
      email: user.email,
      provider: user.provider || "google",
    });

    const { password, ...userSafe } = user;

    return res.json({
      message: "Google login successful",
      token: jwtToken,
      user: userSafe,
    });
  } catch (err) {
    console.error("Google auth error", err);
    return res.status(401).json({ message: "Invalid Google token" });
  }
});

/**
 * for seller
 * GET /auth/google
 * header: Authorization: Bearer <token>
 */
router.post("/google/sel", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    if (!email)
      return res.status(400).json({ message: "email not found in token" });

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: sub }, { email }],
      },
      include: { profile: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId: sub,
          provider: "google",
          role: seller,
          profile: {
            create: {
              name: name || "",
            },
          },
        },
        include: { profile: true },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: sub },
        include: { profile: true },
      });
    }

    const jwtToken = generateToken({
      id: user.id,
      email: user.email,
      provider: user.provider || "google",
    });

    const { password, ...userSafe } = user;

    return res.json({
      message: "Google login successful",
      token: jwtToken,
      user: userSafe,
    });
  } catch (err) {
    console.error("Google auth error", err);
    return res.status(401).json({ message: "Invalid Google token" });
  }
});

module.exports = router;
