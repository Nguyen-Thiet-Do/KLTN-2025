const metadataService = require('../service/metadataService');

const getAllGenres = async (req, res) => {
    try {
        const genres = await metadataService.getAllGenres();
        res.json({ success: true, genres });
    } catch (err) {
        console.error('❌ Lỗi khi lấy danh sách thể loại:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
 const getAllAuthors = async (req, res) => {
    try {
        const authors = await metadataService.getAllAuthors();
        res.json({ success: true, authors });
    }
    catch (err) {
        console.error('❌ Lỗi khi lấy danh sách tác giả:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const getAllCategories = async (req, res) => {
    try {
        const categories = await metadataService.getAllCategories();
        res.json({ success: true, categories });
    }
    catch (err) {
        console.error('❌ Lỗi khi lấy danh sách thể loại:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
const getAllPublishers = async (req, res) => {
    try {
        const publishers = await metadataService.getAllPublishers();
        res.json({ success: true, publishers });
    }
    catch (err) {
        console.error('❌ Lỗi khi lấy danh sách nhà xuất bản:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const addAuthor = async (req, res) => {
    try {
        const data = req.body;
        const result = await metadataService.addAuthor(data);
        res.json({ success: true, message: 'Thêm tác giả thành công', author: result });
    } catch (err) {
        console.error('❌ Lỗi khi thêm tác giả:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const addGenre = async (req, res) => {
    try {
        const data = req.body;
        const result = await metadataService.addGenre(data);
        res.json({ success: true, message: 'Thêm thể loại thành công', genre: result });
    }
    catch (err) {
        console.error('❌ Lỗi khi thêm thể loại:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const addPublisher = async (req, res) => {
    try {
        const data = req.body;
        const result = await metadataService.addPublisher(data);
        res.json({ success: true, message: 'Thêm nhà xuất bản thành công', publisher: result });
    }
    catch (err) {
        console.error('❌ Lỗi khi thêm nhà xuất bản:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getAllGenres,
    getAllAuthors,
    getAllCategories,
    getAllPublishers,
    addAuthor,
    addGenre,
    addPublisher
};