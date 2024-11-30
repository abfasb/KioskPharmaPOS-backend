const express = require('express');
const router = express.Router();
const addProduct = require('../controllers/AdminController');
const multer = require('multer');
const admin = require('../config/firebase');

const db = admin.firestore();

const upload = multer({
    storage: multer.memoryStorage(),
  });

router.post('/add-product', upload.single('image'), addProduct);


router.post('/send-notification', async (req, res) => {
  const { userId, title, message, orderId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required." });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const fcmTokens = userDoc.data().fcmTokens || [];

    const payload = {
      notification: {
        title,
        body: message,
      },
      data: {
        orderId: String(orderId),
      },
    };

    const response = await Promise.all(
      fcmTokens.map(token => admin.messaging().send({
        token,
        ...payload
      }))
    );

    console.log("Notification sent successfully:", response);
    res.status(200).json({ success: true, message: "Notification sent successfully" });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, message: "Failed to send notification" });
  }
});


module.exports = router;

