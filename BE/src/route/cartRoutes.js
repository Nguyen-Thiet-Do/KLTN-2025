const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/auth").requireAuth;
const readerOnly = require("../middleware/readerOnly");   // NOT destructuring
const cartController = require("../controller/cartController");

// GET giỏ hàng
router.get("/", requireAuth, readerOnly, cartController.getCart);

// ADD item
router.post("/add", requireAuth, readerOnly, cartController.addItem);

// DELETE item
router.delete("/:documentId", requireAuth, readerOnly, cartController.removeItem);

// CLEAR all
router.delete("/", requireAuth, readerOnly, cartController.clearCart);

module.exports = router;
