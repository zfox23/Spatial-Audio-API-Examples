const express = require('express');

const app = express.Router();

app.get('/spatial-audio-rooms/test', (req, res) => {
    res.send("How did you find this?");
});

module.exports = app;
