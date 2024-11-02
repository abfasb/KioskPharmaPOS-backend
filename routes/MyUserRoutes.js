const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');

router.post("/kiosk/cart/add", UserController.addToCart);
router.post("/kiosk/view-product/add", UserController.viewProductToCart);
router.delete("/kiosk/cart/remove", UserController.removeProductFromCart);
router.get("/kiosk/cart/:userId", UserController.getUserCart);
router.get("/kiosk/validatePrescription", UserController.validatePrescription);

module.exports = router;
