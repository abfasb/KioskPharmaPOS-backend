const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const admin = require('../config/firebase');
const MyAdminRoutes = require('../routes/MyAdminRoutes');

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

app.listen((PORT),() => {
    console.log('Server is running at Port: ' + PORT);
});
