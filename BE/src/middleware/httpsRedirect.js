// middleware/httpsRedirect.js

/**
 * Redirect HTTP -> HTTPS khi chạy production (đằng sau proxy như Render/Heroku).
 * Dùng được với Express CommonJS.
 */
module.exports = function httpsRedirect(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        // Nếu đã bật trust proxy, req.secure sẽ dùng x-forwarded-proto
        const xfProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const isHttps = req.secure || xfProto === 'https';

        if (!isHttps) {
            const host = req.headers.host || '';
            const url = `https://${host}${req.originalUrl || req.url}`;
            return res.redirect(301, url);
        }
    }

    next();
};
