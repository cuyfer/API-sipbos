// server.js
const app = require('./api/index');
const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
