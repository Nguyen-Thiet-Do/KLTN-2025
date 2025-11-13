const { Author, Category, Genre, Publisher } = require('../model');


const getAllGenres = async () => {
    try {
        const genres = await Genre.findAll({
            where: { deleted: false },
            order: [['name', 'ASC']],
        });
        return genres.map((g) => ({
            genreId: g.genreId,
            name: g.name,
        }));
    } catch (error) {
        console.error('❌ Lỗi getAllGenres:', error);
        throw error;
    }
};

const getAllAuthors = async () => {
    try {
        const authors = await Author.findAll({
            where: { deleted: false },
            order: [['fullName', 'ASC']],
        });
        return authors.map((a) => ({
            authorId: a.authorId,
            fullName: a.fullName,
            note: a.note,
        }));
    } catch (error) {
        console.error('❌ Lỗi getAllAuthors:', error);
        throw error;
    }
};
const getAllCategories = async () => {
    try {
        const categories = await Category.findAll({
            where: { deleted: false },
            order: [['name', 'ASC']],
        });
        return categories.map((c) => ({
            categoryId: c.categoryId,
            name: c.name,
            
        }));
    }
    catch (error) {
        console.error('❌ Lỗi getAllCategories:', error);
        throw error;
    }
};

const getAllPublishers = async () => {
    try {
        const publishers = await Publisher.findAll({
            where: { deleted: false },
            order: [['name', 'ASC']],
        });
        return publishers.map((p) => ({
            publisherId: p.publisherId,
            name: p.name,
            note: p.note,
        }));
    } catch (error) {
        console.error('❌ Lỗi getAllPublishers:', error);
        throw error;
    }
};


const addGenre = async (name) => {
    try {
        const newGenre = await Genre.create({ name });
        return {
            genreId: newGenre.genreId,
            name: newGenre.name,
        };
    } catch (error) {
        console.error('❌ Lỗi addGenre:', error);
        throw error;
    }
};

const addAuthor = async (fullName, note) => {
    try {
        const newAuthor = await Author.create({ fullName, note });
        return {
            authorId: newAuthor.authorId,
            fullName: newAuthor.fullName,
            note: newAuthor.note,
        };
    } catch (error) {
        console.error('❌ Lỗi addAuthor:', error);
        throw error;
    }

};

const addPublisher = async (name, note) => {
    try {
        const newpublisher = await Publisher.create({ name, note });
        return {
            publisherId: newpublisher.publisherId,
            name: newpublisher.name,
            note: newpublisher.note,
        };
    } catch (error) {
        console.error('❌ Lỗi addPublisher:', error);
        throw error;
    }
};


module.exports = {
    getAllGenres, getAllAuthors, getAllCategories, getAllPublishers,
    addGenre, addAuthor, addPublisher
};
