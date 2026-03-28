const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  country: { type: String, required: true },
  role: { type: String, required: true },
  basePrice: { type: Number, required: true },
  isOverseas: { type: Boolean, required: true },
  image: { type: String }
});

const Player = mongoose.model('Player', playerSchema);
module.exports = Player;
