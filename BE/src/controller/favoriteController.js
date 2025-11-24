const { FavoriteItem, Document } = require("../model");

module.exports = {
  async getFavorite(req, res) {
    const readerId = req.user.readerId;

    const items = await FavoriteItem.findAll({
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

  async addFavorite(req, res) {
    const readerId = req.user.readerId;
    const { documentId } = req.body;

    const exists = await FavoriteItem.findOne({ where: { readerId, documentId } });
    if (exists) return res.status(400).json({ message: "Đã có trong yêu thích" });

    await FavoriteItem.create({ readerId, documentId });
    res.json({ message: "Đã thêm vào yêu thích" });
  },

  async removeFavorite(req, res) {
    const readerId = req.user.readerId;
    const { documentId } = req.params;

    await FavoriteItem.destroy({ where: { readerId, documentId } });
    res.json({ message: "Đã xóa" });
  },

  async clearFavorite(req, res) {
    const readerId = req.user.readerId;
    await FavoriteItem.destroy({ where: { readerId } });
    res.json({ message: "Đã xóa toàn bộ danh sách yêu thích" });
  }
};
