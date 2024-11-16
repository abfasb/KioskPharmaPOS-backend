const { v4: uuidv4 } = require('uuid');
const admin = require('../config/firebase');
const { sendNotification } = require('./UserController');

const db = admin.firestore();
const bucket = admin.storage().bucket();


const addProduct = async (req, res) => {
  try {
    const { 
      name, 
      price, 
      description, 
      stockLevel, 
      prescriptionNeeded, 
      purposes = [], 
      dosages = [], 
      category, 
      expirationDate 
    } = req.body;

    if (!name || !price || !description || !stockLevel || !prescriptionNeeded || !expirationDate) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (isNaN(Date.parse(expirationDate))) {
      return res.status(400).json({ message: 'Expiration date must be a valid date' });
    }

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
      expirationDate: new Date(expirationDate), 
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



module.exports = { addProduct, sendNotification };




module.exports = addProduct;
