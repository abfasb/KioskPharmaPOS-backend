const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

const PORT = 5000;

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

app.listen((PORT),() => {
    console.log('Server is running at Port: ' + PORT);
})