const express = require('express');
const router = express.Router();
const addProduct = require('../controllers/AdminController');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
  });

router.post('/add-product', upload.single('image'), addProduct)

module.exports = router;

