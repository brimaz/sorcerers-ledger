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

// Trust proxy for accurate IP detection (important for security checks)
app.set('trust proxy', true);

// Enable compression for all responses
app.use(compression());

// Middleware to ensure API routes always return JSON
app.use('/api', (req, res, next) => {
  // Set JSON content type for all API routes
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Load exchange rate service
const exchangeRates = require('./exchangeRates');

// Initialize exchange rates on server startup
exchangeRates.initializeExchangeRates();

// Start scheduled daily refresh (checks every hour, refreshes if stale)
exchangeRates.startScheduledRefresh();

// Load batch update service
const batchUpdate = require('./batchUpdate');

// Start scheduled batch updates (runs daily at 2 AM)
// Set ENABLE_BATCH_UPDATE_SCHEDULER=false in .env to disable
if (process.env.ENABLE_BATCH_UPDATE_SCHEDULER !== 'false') {
  batchUpdate.startScheduledBatchUpdate();
} else {
  console.log('Batch update scheduler disabled (set ENABLE_BATCH_UPDATE_SCHEDULER=false)');
}

// Define API routes BEFORE static middleware to ensure they're matched first
app.get('/api/config', (req, res) => {
  const trackingLink = process.env.TCGPLAYER_API_TRACKING_LINK || '';
  res.json({
    tcgplayerTrackingLink: trackingLink
  });
});

/**
 * Secure batch update endpoint
 * Only accessible from localhost/internal network (for app use only)
 * POST method only - GET requests return method not allowed
 */
app.get('/api/batch-update', (req, res) => {
  // Return method not allowed for GET requests
  res.status(405).json({
    success: false,
    message: 'Method Not Allowed: This endpoint only accepts POST requests',
    allowedMethods: ['POST']
  });
});

app.post('/api/batch-update', (req, res) => {
  // Security check: Only allow from localhost/internal network
  // This endpoint is for internal app use only, not for external access
  // Use req.ip (works with trust proxy) or req.socket.remoteAddress as fallback
  const forwardedIp = req.headers['x-forwarded-for'];
  const clientIp = req.ip || req.socket.remoteAddress;
  const realIp = forwardedIp ? forwardedIp.split(',')[0].trim() : clientIp;
  
  // Check if request is from localhost/internal network
  const isLocalhost = realIp === '127.0.0.1' || 
                      realIp === '::1' || 
                      realIp === '::ffff:127.0.0.1' ||
                      realIp.startsWith('192.168.') ||
                      realIp.startsWith('10.') ||
                      realIp.startsWith('172.16.') ||
                      realIp.startsWith('172.17.') ||
                      realIp.startsWith('172.18.') ||
                      realIp.startsWith('172.19.') ||
                      realIp.startsWith('172.20.') ||
                      realIp.startsWith('172.21.') ||
                      realIp.startsWith('172.22.') ||
                      realIp.startsWith('172.23.') ||
                      realIp.startsWith('172.24.') ||
                      realIp.startsWith('172.25.') ||
                      realIp.startsWith('172.26.') ||
                      realIp.startsWith('172.27.') ||
                      realIp.startsWith('172.28.') ||
                      realIp.startsWith('172.29.') ||
                      realIp.startsWith('172.30.') ||
                      realIp.startsWith('172.31.');
  
  // Block all external requests - this is for internal use only
  if (!isLocalhost) {
    console.warn(`Unauthorized batch update attempt from external IP: ${realIp}`);
    return res.status(403).json({
      success: false,
      message: 'Forbidden: This endpoint is only accessible from localhost/internal network'
    });
  }
  
  // Run batch update
  batchUpdate.runBatchUpdate()
    .then(result => {
      if (result.success) {
        res.json({
          success: true,
          message: 'Batch update completed successfully',
          output: result.output
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Batch update failed',
          error: result.error,
          exitCode: result.exitCode
        });
      }
    })
    .catch(error => {
      res.status(500).json({
        success: false,
        message: 'Failed to run batch update',
        error: error.message
      });
    });
});

/**
 * Public API endpoint - Returns exchange rates
 * This is safe to be public (exchange rates are public data)
 */
app.get('/api/exchange-rates', async (req, res) => {
  // Ensure we always return JSON - set this FIRST before any async operations
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // Check if client wants to force refresh
    const forceRefresh = req.query.refresh === 'true';
    
    const rates = await exchangeRates.getExchangeRates(forceRefresh);
    
    if (!rates) {
      throw new Error('Failed to get exchange rates');
    }
    
    // Return only the rates (not metadata) for security/privacy
    const response = {
      rates: {},
      lastUpdated: rates.lastUpdated || new Date().toISOString()
    };
    
    // Copy only rate values (exclude metadata)
    Object.keys(rates).forEach(key => {
      if (key !== 'lastUpdated' && key !== 'source' && typeof rates[key] === 'number') {
        response.rates[key] = rates[key];
      }
    });
    
    // Set cache headers - allow caching for 1 hour (rates update daily)
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.json(response);
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    // Always return JSON, even on error
    try {
      const defaultRates = exchangeRates.getDefaultRates();
      res.status(500).json({
        rates: defaultRates,
        lastUpdated: defaultRates.lastUpdated || new Date().toISOString(),
        error: 'Using default rates due to API error'
      });
    } catch (fallbackError) {
      // Last resort - return minimal JSON response
      console.error('Failed to get default rates:', fallbackError);
      res.status(500).json({
        rates: { USD: 1.0 },
        lastUpdated: new Date().toISOString(),
        error: 'Critical error: Unable to provide exchange rates'
      });
    }
  }
});

/**
 * File listing endpoint - SECURED
 * Only allows listing specific allowed directories to prevent path traversal attacks
 */
app.get('/list-files', (req, res) => {
  try {
    const targetPath = req.query.path;
    if (!targetPath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Security: Only allow specific safe paths
    // Prevent path traversal attacks by restricting to allowed directories
    const allowedPaths = [
      'card-data',
      'card-data/product-info'
    ];

    // Check if the requested path is allowed
    const isAllowed = allowedPaths.some(allowed => {
      // Exact match or starts with allowed path (but not going up directories)
      return targetPath === allowed || 
             (targetPath.startsWith(allowed + '/') && !targetPath.includes('..'));
    });

    if (!isAllowed) {
      console.warn(`Unauthorized list-files request for path: ${targetPath}`);
      return res.status(403).json({ 
        error: 'Forbidden: Access to this directory is not allowed' 
      });
    }

    // Resolve path relative to public directory
    // path.join() helps prevent path traversal, but we've already validated above
    const absolutePath = path.join(publicDir, targetPath);

    // Additional security: Ensure the resolved path is still within publicDir
    const resolvedPath = path.resolve(absolutePath);
    const resolvedPublicDir = path.resolve(publicDir);
    
    if (!resolvedPath.startsWith(resolvedPublicDir)) {
      console.warn(`Path traversal attempt detected: ${targetPath}`);
      return res.status(403).json({ 
        error: 'Forbidden: Invalid path' 
      });
    }

    fs.readdir(absolutePath, (err, files) => {
      if (err) {
        console.error('Error reading directory:', err);
        return res.status(500).json({ error: 'Unable to read directory' });
      }
      res.json(files);
    });
  } catch (error) {
    console.error('Error in /list-files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
  // Skip API routes - they should have been handled already
  if (req.path.startsWith('/api/')) {
    return next(); // Let Express 404 handler deal with it
  }
  
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

