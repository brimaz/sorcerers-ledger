const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const compression = require('compression');

// Get paths relative to this server file
const appDir = path.join(__dirname, '..');
const publicDir = path.join(appDir, 'public');
const repoRoot = path.join(__dirname, '..', '..', '..');

// Load .env from repo root
require('dotenv').config({ path: path.join(repoRoot, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Enable compression for all responses
app.use(compression());

// Define API routes BEFORE static middleware to ensure they're matched first
app.get('/api/config', (req, res) => {
  const trackingLink = process.env.TCGPLAYER_API_TRACKING_LINK || '';
  res.json({
    tcgplayerTrackingLink: trackingLink
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
  maxAge: '1y', // Cache static assets for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Ensure JavaScript files are served with correct MIME type
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    // Special caching for large JSON data files - shorter cache with revalidation
    if (filePath.includes('card-data') && filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate'); // 1 hour cache
    }
  }
}));

// Serve core frontend assets
// Route /core serves from core/ directory, so /core/frontend/components/... works correctly
app.use('/core', express.static(path.join(repoRoot, 'core'), {
  maxAge: '1y', // Cache core components for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Serve app config files
app.use('/apps', express.static(path.join(repoRoot, 'apps'), {
  maxAge: '1y', // Cache config files for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Serve shared assets from root (favicon, etc.)
app.use('/assets', express.static(path.join(repoRoot, 'assets'), {
  maxAge: '1y', // Cache assets for 1 year
  etag: true,
  lastModified: true
}));

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
  // Set no-cache for index.html to ensure users get updates
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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

