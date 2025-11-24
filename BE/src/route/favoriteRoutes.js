const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/auth").requireAuth;
const readerOnly = require("../middleware/readerOnly");
const favoriteController = require("../controller/favoriteController");

router.get("/", requireAuth, readerOnly, favoriteController.getFavorite);

router.post("/add", requireAuth, readerOnly, favoriteController.addFavorite);

router.delete("/:documentId", requireAuth, readerOnly, favoriteController.removeFavorite);

router.delete("/", requireAuth, readerOnly, favoriteController.clearFavorite);

module.exports = router;
