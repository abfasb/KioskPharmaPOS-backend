const express = require('express');
const router = express.Router();
const addProduct = require('../controllers/AdminController');
const multer = require('multer');
const admin = require('../config/firebase');

const upload = multer({
    storage: multer.memoryStorage(),
  });

router.post('/add-product', upload.single('image'), addProduct);


router.post('/send-notification', async (req, res) => {
  const { title, body, recipientToken } = req.body;

  if (!recipientToken) {
    return res.status(400).json({ error: 'Recipient token is required' });
  }

  const message = {
    notification: {
      title,
      body,
    },
    token: recipientToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);
    res.status(200).json({ message: 'Notification sent successfully', response });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Error sending notification', details: error });
  }
});

module.exports = router;

