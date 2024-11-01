const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');

router.post("/kiosk/cart/add", UserController.addToCart);
router.get("/kiosk/cart/:userId", UserController.getUserCart);

module.exports = router;