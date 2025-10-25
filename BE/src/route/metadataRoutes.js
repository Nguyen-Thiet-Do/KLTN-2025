const express = require("express");
const router = express.Router();
const {requireAuth, requireRole} = require("../middleware/auth");

const metadataController = require("../controller/metadataController");

router.get('/genres', metadataController.getAllGenres);
router.get('/authors', metadataController.getAllAuthors);
router.get('/categories', metadataController.getAllCategories);
router.get('/publishers', metadataController.getAllPublishers);

router.post('/author', requireAuth, requireRole([1,2]), metadataController.addAuthor);
router.post('/genre', requireAuth, requireRole([1,2]), metadataController.addGenre);
router.post('/publisher', requireAuth, requireRole([1,2]), metadataController.addPublisher); 

module.exports = router;
