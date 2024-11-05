const admin = require('../config/firebase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

    if (!productId || !userId || !imageUrl || !name || !price || !quantity) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Fetch product to check stock level
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            return res.status(404).send('Product not found');
        }

        const productData = productDoc.data();
        if (productData.stockLevel <= 0) {
            return res.status(400).send('Product is out of stock');
        }

        const cartRef = db.collection('carts').doc(userId);
        const cartDoc = await cartRef.get();
        let items = cartDoc.exists ? cartDoc.data().items || [] : [];

        // Check if the item is already in the cart
        const existingItemIndex = items.findIndex(
            (item) => item.productId === productId && item.dosage === dosage
        );

        if (existingItemIndex >= 0) {
            // Increase quantity of existing item
            items[existingItemIndex].quantity += quantity;
        } else {
            // Add as a new item
            items.push({
                productId,
                userId,
                imageUrl,
                name,
                price,
                quantity,
                dosage: dosage || null
            });
        }

        // Update cart with the modified items array
        await cartRef.set({ items }, { merge: true });

        return res.status(201).send('Item added to cart successfully');
    } catch (error) {
        console.error('Error adding item to cart: ', error);
        return res.status(500).send('Internal Server Error');
    }
};


const removeProductFromCart = async (req, res) => {
    const { userId, productId } = req.body;

    // Check for required fields
    if (!userId || !productId) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Reference to the user's cart
        const userCartRef = db.collection('carts').doc(userId);
        const userCartDoc = await userCartRef.get();

        // Check if cart exists
        if (!userCartDoc.exists) {
            return res.status(404).send('User cart not found');
        }

        // Retrieve cart items
        const cartItems = userCartDoc.data().items || [];
        // Find the item to remove
        const itemToRemove = cartItems.find(item => item.productId === productId);

        // Check if item is in cart
        if (!itemToRemove) {
            return res.status(404).send('Item not found in cart');
        }

        // Remove item from cart
        await userCartRef.update({
            items: admin.firestore.FieldValue.arrayRemove(itemToRemove)
        });

        // Success response
        return res.status(200).send('Item removed from cart successfully');
    } catch (error) {
        console.error('Error removing item from cart:', error);
        return res.status(500).send('Internal Server Error');
    }
};






const integrateStripe = async (req, res) => {
    try {
      const { items, userId, paymentMethod, orderId, taxRate, discountAmount } = req.body;
  
      const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const totalAfterDiscount = subtotal - discountAmount;
      const totalAmount = (totalAfterDiscount + totalAfterDiscount * taxRate) * 100;
  
      if (totalAmount < 3000) {
        return res.status(400).json({ error: "The minimum order amount is PHP 30. Consider using cash instead. Thank you!" });
      }
  
      const transactionData = {
        userId,
        orderId,
        paymentMethod,
        items,
        taxRate,
        discountAmount,
        total: totalAmount / 100, 
        timestamp: admin.firestore.Timestamp.now(),
        checkoutStatus: "processing",
      };
  
      await db.collection("transactions").doc(orderId).set(transactionData);
  
      const lineItems = items.map((item) => ({
        price_data: {
          currency: "php",
          product_data: { name: item.name, description: item.description },
          unit_amount: item.price * 100,
        },
        quantity: item.quantity,
      }));
  
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `http://localhost:5173/user/kiosk/payment-success?orderId=${orderId}`,
        cancel_url: "https://example.com/cancel",
      });
  
      res.json({ sessionId: session.id });
    } catch (error) {
      console.error("Error creating Checkout Session:", error);
      res.status(500).json({ error: "There was an error processing your payment. Please try again later." });
    }
  };
  
  
  
  


module.exports = { addToCart, getUserCart, validatePrescription, viewProductToCart, removeProductFromCart, integrateStripe };