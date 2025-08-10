require("dotenv").config();
const express = require("express");
const { json, urlencoded } = require("express");
const app = express();
const port = process.env.PORT || 3000;
const prisma = require("./src/utils/prisma");
const cors = require("cors");
const authRoutes = require('./src/route/auth.routes');

// middleware
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cors());
// app.options('*', cors());

// Swagger UI
const swaggerUi = require('swagger-ui-express');
const openapi = require('./Doc/openapi.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { validatorUrl: null } }));
app.get('/openapi.json', (req, res) => {
  res.json(openapi);
});

// Rute sederhana
app.get("/", (req, res) => {
  res.send("🚀 Auth API is running...");
});

// Mount routes
app.use('/v1/auth', authRoutes);

app.listen(port, () => {
  console.log(`🚀 Server ready at http://localhost:${port}`);
});
