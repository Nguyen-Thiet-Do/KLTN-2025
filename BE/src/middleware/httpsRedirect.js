// middleware/httpsRedirect.js

export const httpsRedirect = (req, res, next) => {
  // Chỉ áp dụng khi ở production
  if (process.env.NODE_ENV === 'production') {
    // Kiểm tra xem request có phải HTTP không
    // x-forwarded-proto được dùng khi app chạy phía sau proxy (như Render, Heroku)
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
  }
  
  next();
};