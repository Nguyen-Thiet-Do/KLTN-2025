const { Reader } = require("../model");

module.exports = async (req, res, next) => {
  if (!req.user || !req.user.accountId) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  const reader = await Reader.findOne({
    where: { accountId: req.user.accountId }
  });

  if (!reader)
    return res.status(403).json({ message: "Không phải độc giả" });

  req.user.readerId = reader.readerId;
  next();
};
