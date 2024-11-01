const admin = require('../config/firebase');

const db = admin.firestore();

const addToCart = async (req, res) => {
    console.log("Request body:", req.body);
    const { userId, productId, name, price, imageUrl, quantity = 1 } = req.body;

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
                const newItem = { productId, name, price, imageUrl, quantity };
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



module.exports = { addToCart, getUserCart };