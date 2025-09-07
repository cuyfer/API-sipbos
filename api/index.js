require("dotenv").config();
const express = require("express");
const { json, urlencoded } = require("express");
const app = express();
const port = process.env.PORT || 3000;
const prisma = require("../src/utils/prisma");
const cors = require("cors");
const authRoutes = require("../src/routes/auth.routes");
const productRoutes = require("../src/routes/product.routes");
const eventRoutes = require("../src/routes/event.routes");
const userProfile = require("../src/routes/user.routes");
// const serverless = require("serverless-http");

// middleware
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cors());
// app.options('*', cors());

// Rute sederhana
app.get("/", (req, res) => {
  res.send("🚀 Auth API is running...");
});

// Mount routes
// Auth
app.use("/v1/auth", authRoutes);

// Product
app.use("/v1", productRoutes);
app.use("/v1", eventRoutes);

//userProfile
app.use("/v1", userProfile);

app.listen(port, () => {});

module.exports = app;
// module.exports.handler = serverless(app);
