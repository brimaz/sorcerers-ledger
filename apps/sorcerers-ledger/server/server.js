const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get paths relative to this server file
const appDir = path.join(__dirname, '..');
const publicDir = path.join(appDir, 'public');
const repoRoot = path.join(__dirname, '..', '..', '..');

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

  // Resolve path relative to public directory
  const absolutePath = path.join(publicDir, targetPath);

  fs.readdir(absolutePath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).send('Unable to read directory');
    }
    res.json(files);
  });
});

// Serve static files from the app's public directory
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    // Ensure JavaScript files are served with correct MIME type
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Serve core frontend assets
// Route /core serves from core/ directory, so /core/frontend/components/... works correctly
app.use('/core', express.static(path.join(repoRoot, 'core'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Serve app config files
app.use('/apps', express.static(path.join(repoRoot, 'apps'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Serve shared assets from root (favicon, etc.)
app.use('/assets', express.static(path.join(repoRoot, 'assets')));

// Handle client-side routing - serve index.html for routes that don't match static files
// Only match routes that don't have file extensions (to avoid catching .js, .css, etc.)
app.get('*', (req, res, next) => {
  // Skip if this looks like a file request (has extension and not .html)
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
  const isHtml = req.path.endsWith('.html') || req.path.endsWith('/') || req.path === '';
  
  if (hasExtension && !isHtml) {
    // Let Express 404 handler deal with missing files
    return next();
  }
  
  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start servers based on environment
const isProduction = process.env.NODE_ENV === 'production';
const sslCertPath = process.env.SSL_CERT_PATH;
const sslKeyPath = process.env.SSL_KEY_PATH;

// HTTPS server (port 443) - Production only
if (isProduction && sslCertPath && sslKeyPath) {
  try {
    const httpsOptions = {
      cert: fs.readFileSync(sslCertPath),
      key: fs.readFileSync(sslKeyPath)
    };
    
    https.createServer(httpsOptions, app).listen(443, '::', () => {
      console.log('HTTPS server listening on port 443');
    });
    
    // HTTP server (port 80) - Redirect to HTTPS
    const httpApp = express();
    httpApp.use((req, res) => {
      const host = req.headers.host || req.hostname;
      res.redirect(301, `https://${host}${req.url}`);
    });
    
    http.createServer(httpApp).listen(80, '::', () => {
      console.log('HTTP redirect server listening on port 80');
    });
    
    console.log('Production mode: HTTPS (443) and HTTP redirect (80) enabled');
  } catch (error) {
    console.error('Error setting up HTTPS:', error.message);
    console.error('Falling back to HTTP only');
    // Fall through to HTTP server below
  }
}

// Development/fallback HTTP server (port 3000 or PORT)
if (!isProduction || !sslCertPath || !sslKeyPath) {
  app.listen(PORT, '::', () => {
    console.log(`Server listening on port ${PORT} (HTTP)`);
    if (isProduction) {
      console.log('Note: HTTPS not configured. Set SSL_CERT_PATH and SSL_KEY_PATH for HTTPS.');
    }
  });
}

