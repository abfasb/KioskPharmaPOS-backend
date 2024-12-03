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

    if (!userDoc.exists) {
      return res.status(404).send({ error: 'User not found' });
    }

    await userRef.update({
      fcmTokens: [token],
    });

    return res.status(200).send({ message: 'FCM Token replaced successfully' });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    return res.status(500).send({ error: 'Failed to update FCM token' });
  }
});


app.post('/save-fcm-token/admin', async (req, res) => {
const { email, token } = req.body;

if (!email || !token) {
  return res.status(400).send({ error: 'Email and token are required' });
}

try {
  const adminRef = db.collection('admin').doc(email);
  
  await adminRef.set({ fcmTokens: [token] }, { merge: true });

  return res.status(200).send({ message: 'FCM Token updated successfully' });
} catch (error) {
  console.error('Error updating FCM token:', error);
  return res.status(500).send({ error: 'Failed to update FCM token' });
}
});


app.get('/get-collection', async (req, res) => {
  const schema = [];

  const collections = await db.listCollections();
  for (const collection of collections) {
      const collectionData = { name: collection.id, attributes: [], subcollections: [], items: [] };

      const snapshot = await collection.limit(1).get();
      snapshot.forEach(doc => {
          const fields = doc.data();
          for (const [key, value] of Object.entries(fields)) {
              collectionData.attributes.push({ name: key, type: typeof value });
              if (key === 'items') { 
                  collectionData.items.push(value);
              }
          }
      });

      const subcollections = await db.collection(collection.id).doc().listCollections();
      collectionData.subcollections = subcollections.map(sub => sub.id);

      schema.push(collectionData);
  }

  res.json(schema);
});




app.listen((PORT),() => {
    console.log('Server is running at Port: ' + PORT);
});
