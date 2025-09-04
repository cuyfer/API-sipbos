// server.js
const app = require('./api/index');
const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`
=========================================================
|      Author: Adyfas                                   |
|      Server: Running....                              |
|      Port: ${PORT}                                       |
|      Protocol: http                                   |
|      Url : http://localhost:${PORT}                      |
|                                                       |  
|                                                       |
=========================================================
    `);
});
