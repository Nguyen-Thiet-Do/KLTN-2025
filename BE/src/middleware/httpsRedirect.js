/**
 * Redirect HTTP -> HTTPS when running in production behind a proxy (Render/Heroku).
 * Skip redirect for endpoints that must remain public or are called by external services (webhooks, health).
 */

module.exports = function httpsRedirect(req, res, next) {
    try {
        // Always allow local/dev without forcing redirect
        if (process.env.NODE_ENV !== 'production') return next();

        // Do not redirect specific paths used by external services or for health checks
        const path = (req.path || req.url || '').toString();
        const skipPrefixes = [
            '/api/payos/webhook', // PayOS webhook
            '/pay',               // optional return/cancel pages
            '/health',            // health check
            '/.well-known'        // ACME / cert checks if any
        ];
        for (const p of skipPrefixes) {
            if (path.startsWith(p)) return next();
        }

        // If behind a proxy (Render), x-forwarded-proto will be set.
        const xfProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const isHttps = req.secure || xfProto === 'https';

        if (!isHttps) {
            const host = req.headers.host || '';
            const url = `https://${host}${req.originalUrl || req.url}`;
            return res.redirect(301, url);
        }

        return next();
    } catch (err) {
        // If anything unexpected happens, don't block requests — safe fallback
        console.error('httpsRedirect middleware error:', err);
        return next();
    }
};
