const { v4: uuidv4 } = require('uuid');
const admin = require('../config/firebase');
const { sendNotification } = require('./UserController');

const db = admin.firestore();
const bucket = admin.storage().bucket();

const addProduct = async (req, res) => {
  try {
    const { name, price, description, stockLevel, prescriptionNeeded, purposes, dosages, category } = req.body;

    if (!name || !price || !description || !stockLevel || !prescriptionNeeded) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if a product with the same name already exists
    const existingProduct = await db.collection('products')
      .where('name', '==', name)
      .get();

    if (!existingProduct.empty) {
      return res.status(409).json({ message: 'Product with this name already exists' });
    }

    let imageUrl = '';

    if (req.file) {
      const file = bucket.file(`products/${Date.now()}_${req.file.originalname}`);
      await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
      });
      const signedUrls = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' }); 
      imageUrl = signedUrls[0];
    }

    const productCategory = prescriptionNeeded === 'yes' ? 'Prescription Medication' : category;

    const newProduct = {
      name,
      price: parseFloat(price),
      description,
      stockLevel: parseInt(stockLevel),
      prescriptionNeeded: prescriptionNeeded === 'yes',
      purposes: Array.isArray(purposes) ? purposes : [],
      dosages: Array.isArray(dosages) ? dosages : [],
      imageUrl: imageUrl,
      category: productCategory,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const addedProduct = await db.collection('products').add(newProduct);
    const recipientToken = 'USER_FCM_TOKEN_HERE';  // Replace with actual token
    await sendNotification('New Product Added', `${name} is now available in our store`, recipientToken);
    
    res.status(201).json({
      message: 'Product added successfully',
      productId: addedProduct.id,
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Failed to add product', error });
  }
};

const sendNotifications = async (req, res) => {
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
}

module.exports = { addProduct, sendNotification };




module.exports = addProduct;
