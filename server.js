const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

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

app.listen(PORT, '::', () => {
  console.log(`Server listening on port ${PORT}`);
});
