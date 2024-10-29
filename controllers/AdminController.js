const { v4: uuidv4 } = require('uuid');
const admin = require('../config/firebase');

const db = admin.firestore();
const bucket = admin.storage().bucket();

const addProduct = async (req, res) => {
  try {
    const { name, price, description, stockLevel, prescriptionNeeded, purposes, dosages, category } = req.body;

    if (!name || !price || !description || !stockLevel || !prescriptionNeeded) {
      return res.status(400).json({ message: 'All fields are required' });
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

    const newProduct = {
      name,
      price: parseFloat(price),
      description,
      stockLevel: parseInt(stockLevel),
      prescriptionNeeded: prescriptionNeeded === 'yes',
      purposes: Array.isArray(purposes) ? purposes : [],
      dosages: Array.isArray(dosages) ? dosages : [],
      imageUrl: imageUrl,
      category,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const addedProduct = await db.collection('products').add(newProduct);

    res.status(201).json({
      message: 'Product added successfully',
      productId: addedProduct.id,
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Failed to add product', error });
  }
};


module.exports = addProduct;