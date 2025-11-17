const { CartItem, Document } = require("../model");

module.exports = {
  async getCart(req, res) {
    const readerId = req.user.readerId;

    const items = await CartItem.findAll({
      where: { readerId },
      include: [
        {
          model: Document,
          attributes: ["documentId", "title", "coverPhoto"]
        }
      ]
    });

    res.json(items.map(i => ({
      documentId: i.documentId,
      title: i.Document.title,
      coverPhoto: i.Document.coverPhoto
    })));
  },

  async addItem(req, res) {
    const readerId = req.user.readerId;
    const { documentId } = req.body;

    const exists = await CartItem.findOne({ where: { readerId, documentId } });
    if (exists) return res.status(400).json({ message: "Đã có trong giỏ" });

    await CartItem.create({ readerId, documentId });
    res.json({ message: "Đã thêm vào giỏ" });
  },

  async removeItem(req, res) {
    const readerId = req.user.readerId;
    const documentId = req.params.documentId;

    await CartItem.destroy({ where: { readerId, documentId } });
    res.json({ message: "Đã xóa" });
  },

  async clearCart(req, res) {
    const readerId = req.user.readerId;
    await CartItem.destroy({ where: { readerId } });
    res.json({ message: "Đã xóa toàn bộ giỏ" });
  }
};
