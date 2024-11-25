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
      return res.status(404).json({ success: true, message: "Cart is empty", products: [] });
    }

    const cartData = cartDoc.data();
    return res.status(200).json({ success: true, products: cartData.items || [], userId: cartData.userId });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return res.status(500).json({ success: false, message: "Error fetching cart" });
  }
};



const validatePrescription = async (req, res) => {
    const { text } = req.body;
  
    try {
      const productsRef = db.collection('products');
      const snapshot = await productsRef.where('name', '==', text).get();
  
      if (!snapshot.empty) {
        const productData = snapshot.docs[0].data();
        res.json({ success: true, message: 'Product is valid for prescription.', product: productData });
      } else {
        res.json({ success: false, message: 'Product not found.' });
      }
    } catch (error) {
      console.error('Error validating product:', error);
      res.status(500).json({ success: false, message: 'Validation failed.' });
    }
  };
  
  
  const viewProductToCart = async (req, res) => {
    const { productId, userId, imageUrl, name, price, quantity, dosage } = req.body;

    if (!productId || !userId || !imageUrl || !name || !price || !quantity || isNaN(quantity)) {
        console.error('Missing or invalid required fields:', req.body);
        return res.status(400).send('Missing or invalid required fields');
    }

    try {
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            console.error('Product not found:', productId);
            return res.status(404).send('Product not found');
        }

        const productData = productDoc.data();

        if (productData.stockLevel <= 0) {
            console.error('Product is out of stock:', productId);
            return res.status(400).send('Product is out of stock');
        }

        const cartRef = db.collection('carts').doc(userId);
        const cartDoc = await cartRef.get();
        let items = cartDoc.exists ? cartDoc.data().items || [] : [];

        const existingItemIndex = items.findIndex(
            (item) => item.productId === productId && item.dosage === dosage
        );

        if (existingItemIndex >= 0) {
            items[existingItemIndex].quantity += quantity;
        } else {
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

        await cartRef.set({ items }, { merge: true });


        console.log('Item added to cart successfully');
        return res.status(201).send('Item added to cart successfully');
    } catch (error) {
        console.error('Error adding item to cart:', error);
        return res.status(500).send('Internal Server Error');
    }
};

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


const integrateStripe = async (req, res) => {
  try {
    const { items, userId, paymentMethod, orderId, tax, discountAmount, subTotal } = req.body;

    const finalTotalAmount = subTotal + tax - discountAmount; 
    const calculatedTax = tax - discountAmount;

    if (finalTotalAmount < 30) {
      return res.status(400).json({ error: "The minimum order amount is PHP 30. Consider using cash instead. Thank you!" });
    }

    const transactionData = {
      userId,
      orderId,
      paymentMethod,
      items,
      tax,
      discountAmount,
      subTotal,
      total: finalTotalAmount,
      timestamp: admin.firestore.Timestamp.now(),
      checkoutStatus: "processing",
    };

    await db.collection("transactions").doc(orderId).set({
      ...transactionData,
      items: items.map((item) => ({
        ...item,
        dosage: item.description,
      })),
    });

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "php",
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    if (calculatedTax > 0) {
      lineItems.push({
        price_data: {
          currency: "php",
          product_data: {
            name: "Tax",
            description: "Calculated Tax with Discount",
          },
          unit_amount: Math.round(calculatedTax * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `http://localhost:5173/user/kiosk/payment-success?orderId=${orderId}`,
      cancel_url: "https://google.com",
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating Checkout Session:", error);
    res.status(500).json({ error: "There was an error processing your payment. Please try again later." });
  }
};


  

  const sendNotification = async (req, res) => {
    const { title, body, recipientToken } = req.body;
  
    console.log("Received recipientToken:", recipientToken);
  
    if (!title || !body || !recipientToken || !Array.isArray(recipientToken)) {
      return res.status(400).json({ message: 'Title, body, and an array of recipientToken(s) are required.' });
    }
  
    const message = {
      notification: {
        title: title,
        body: body,
      },
      tokens: recipientToken, 
    };
  
    try {
      const response = await admin.messaging().sendMulticast(message);
      res.status(200).json({ message: 'Notification sent successfully', response });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ message: 'Failed to send notification', error });
    }
  };
  
const sendOrderNotification = async (req, res) => {
  const { title, message, orderId } = req.body;

  try {
    const adminDoc = await db.collection('admin').doc('checachio@gmail.com').get(); 

    if (!adminDoc.exists) {
      return res.status(404).json({ success: false, message: "Admin document not found." });
    }

    const fcmTokens = adminDoc.data().fcmTokens || [];

    if (fcmTokens.length === 0) {
      console.warn("No FCM tokens found for admin.");
      return res.status(404).json({ success: false, message: "No FCM tokens available for admin." });
    }

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
      fcmTokens.map(async (token) => {
        try {
          return await admin.messaging().send({
            token,
            ...payload,
          });
        } catch (error) {
          console.error("Failed to send to token:", token, error);
          return { error, token };
        }
      })
    );

    console.log("Notification responses:", response);

    // Filter out failed tokens and log or remove as necessary
    const failedTokens = response.filter((res) => res.error).map((res) => res.token);
    if (failedTokens.length > 0) {
      console.warn("Some tokens failed:", failedTokens);
      // Optionally, remove failed tokens from your database if they are expired
    }

    res.status(200).json({ success: true, message: "Notifications processed.", failedTokens });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, message: "Failed to send notifications" });
  }
}

module.exports = { addToCart, getUserCart, validatePrescription, viewProductToCart, removeProductFromCart, integrateStripe, sendNotification, sendOrderNotification };