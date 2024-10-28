const admin = require('firebase-admin');
const dotenv = require('dotenv');


dotenv.config();

admin.initializeApp({
    credential: admin.credential.applicationDefault(), 
    databaseURL: process.env.VITE_APP_FIREBASE_DATABASE_URL,
    storageBucket: process.env.VITE_APP_FIREBASE_STORAGE_BUCKET
  });


module.exports = admin