const admin = require('../config/firebase');

const db = admin.firestore();

const addToCart = async (req, res) => {
    console.log("Request body:", req.body);
    const { userId, productId, name, price, imageUrl, quantity = 1, dosage = null } = req.body;

    try {
        const cartRef = db.collection("carts").doc(userId);
        
        await db.runTransaction(async (transaction) => {
            const cartDoc = await transaction.get(cartRef);
            let cartData = { items: [], userId };

            if (cartDoc.exists) {
                cartData = cartDoc.data();
            } else {
                transaction.set(cartRef, cartData);
            }

            if (!cartData.items) {
                cartData.items = [];
            }

            const existingProductIndex = cartData.items.findIndex(item => item.productId === productId);
            
            if (existingProductIndex > -1) {
                cartData.items[existingProductIndex].quantity += quantity;
            } else {
                const newItem = { productId, name, price, imageUrl, quantity, dosage };
                cartData.items.push(newItem);
            }
            
            transaction.update(cartRef, { items: cartData.items, userId }); // Store userId with the cart
        });

        return res.status(200).json({ 
            success: true, 
            message: "Product added to cart!" 
        });
    } catch (error) {
        console.error("Error adding to cart:", error);
        return res.status(500).json({ success: false, message: "Error adding to cart: " + error.message });
    }
};


const getUserCart = async (req, res) => {
    const { userId } = req.params;
    
    try {
        const cartDoc = await db.collection("carts").doc(userId).get();
        
        if (!cartDoc.exists) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        const cartData = cartDoc.data();
        return res.status(200).json({ success: true, products: cartData.items, userId: cartData.userId });
    } catch (error) {
        console.error("Error fetching cart:", error);
        return res.status(500).json({ success: false, message: "Error fetching cart" });
    }
};



const validatePrescription = async (req, res) => {
    const { text } = req.body;
  
    try {
      // Assuming your products are stored in a collection called 'products'
      const productsRef = db.collection('products');
      const snapshot = await productsRef.where('name', '==', text).get();
  
      if (!snapshot.empty) {
        // If there is a matching product, return success
        const productData = snapshot.docs[0].data();
        res.json({ success: true, message: 'Product is valid for prescription.', product: productData });
      } else {
        // No matching product found
        res.json({ success: false, message: 'Product not found.' });
      }
    } catch (error) {
      console.error('Error validating product:', error);
      res.status(500).json({ success: false, message: 'Validation failed.' });
    }
  };

module.exports = { addToCart, getUserCart, validatePrescription };