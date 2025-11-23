const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { SERVER_PORT } = require('./config.js');

const app = express();
const PORT = process.env.PORT || SERVER_PORT;

// Define API routes BEFORE static middleware to ensure they're matched first
app.get('/api/config', (req, res) => {
  res.json({
    tcgplayerTrackingLink: process.env.TCGPLAYER_API_TRACKING_LINK || ''
  });
});

app.get('/list-files', (req, res) => {
  const targetPath = req.query.path;
  if (!targetPath) {
    return res.status(400).send('Missing path parameter');
  }

  const absolutePath = path.join(__dirname, targetPath);

  fs.readdir(absolutePath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).send('Unable to read directory');
    }
    res.json(files);
  });
});

// Serve static files from the root directory (after API routes)
app.use(express.static(path.join(__dirname)));

app.listen(PORT, '::', () => {
  console.log(`Server listening on port ${PORT}`);
});
