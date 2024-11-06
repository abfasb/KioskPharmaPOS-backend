const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const admin = require('../config/firebase');
const MyAdminRoutes = require('../routes/MyAdminRoutes');
const MyUserRoutes = require('../routes/MyUserRoutes');

const db = admin.firestore();
const PORT = 5000;

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

app.get('/test-firebase', async (req, res) => {
    try {
        const firestore = admin.firestore();
        const snapshot = await firestore.collection('users').get();
        
        const documents = snapshot.docs.map(doc => doc.data());
        res.json({ success: true, documents });
        console.log('connected ito');
    } catch (error) {
        console.error('Firebase error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use('/admin/', MyAdminRoutes);
app.use('/user/', MyUserRoutes);


app.post('/save-fcm-token', async (req, res) => {
    const { userId, token } = req.body;
  
    if (!userId || !token) {
      return res.status(400).send({ error: 'User ID and token are required' });
    }
  
    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
  
      let tokens = userDoc.exists ? userDoc.data().fcmTokens || [] : [];
      
      if (!tokens.includes(token)) {
        tokens.push(token);
      }
  
      await userRef.update({ fcmTokens: tokens });
  
      return res.status(200).send({ message: 'FCM Token saved successfully' });
    } catch (error) {
      console.error('Error saving FCM token:', error);
      return res.status(500).send({ error: 'Failed to save FCM token' });
    }
});

app.post('/save-fcm-token/admin', async (req, res) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).send({ error: 'Email and token are required' });
  }

  try {
    const adminRef = db.collection('admin').doc(email);

    // Get the admin document
    const adminDoc = await adminRef.get();

    // Check if the document exists and get the current tokens or initialize it
    let tokens = adminDoc.exists ? adminDoc.data().fcmTokens || [] : [];

    // Only add the token if it's not already present
    if (!tokens.includes(token)) {
      tokens.push(token);
    }

    // Update the fcmTokens field of the admin document
    await adminRef.set({ fcmTokens: tokens }, { merge: true });

    return res.status(200).send({ message: 'FCM Token saved successfully' });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return res.status(500).send({ error: 'Failed to save FCM token' });
  }
});




  
app.listen((PORT),() => {
    console.log('Server is running at Port: ' + PORT);
});
