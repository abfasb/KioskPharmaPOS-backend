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

const viewProductToCart = async (req, res) => {
    const { productId, userId, imageUrl, name, price, quantity, dosage } = req.body;

    // Validate input
    if (!productId || !userId || !imageUrl || !name || !price || !quantity) {
        return res.status(400).send('Missing required fields');
    }

    // Prepare the cart item data
    const cartItem = {
        productId,
        userId,
        imageUrl,
        name,
        price,
        quantity,
        dosage: dosage || null // Optional field, default to null if not provided
    };

    try {
        // Add to user's cart in Firestore
        await db.collection('carts').doc(userId).set({
            items: admin.firestore.FieldValue.arrayUnion(cartItem)
        }, { merge: true });

        return res.status(201).send('Item added to cart successfully');
    } catch (error) {
        console.error('Error adding item to cart: ', error);
        return res.status(500).send('Internal Server Error');
    }
}

const removeProductFromCart = async (req, res) => {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
        return res.status(400).send('Missing required fields');
    }

    try {
        const userCartRef = db.collection('carts').doc(userId);
        const userCartDoc = await userCartRef.get();

        if (!userCartDoc.exists) {
            return res.status(404).send('User cart not found');
        }

        const cartItems = userCartDoc.data().items || [];
        const itemToRemove = cartItems.find(item => item.productId === productId);

        if (!itemToRemove) {
            return res.status(404).send('Item not found in cart');
        }

        await userCartRef.update({
            items: admin.firestore.FieldValue.arrayRemove(itemToRemove)
        });

        return res.status(200).send('Item removed from cart successfully');
    } catch (error) {
        console.error('Error removing item from cart:', error);
        return res.status(500).send('Internal Server Error');
    }
};


module.exports = { addToCart, getUserCart, validatePrescription, viewProductToCart, removeProductFromCart };