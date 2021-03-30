const express = require('express');

const app = express.Router();

app.get('/spatial-audio-rooms/whoami', (req, res) => {
  res.send("You are a winner");
});

module.exports = app;
