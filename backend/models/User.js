const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  roomId: { type: String, required: true }, // Isolates teams to a specific lobby
  username: { type: String, required: true },
  teamName: { type: String, required: true },
  budget: { type: Number, default: 1500000000 }, // Defaults to 150 Cr
  isHost: { type: Boolean, default: false }, // Replaces globally-flawed 'isAdmin' logic
  overseasCount: { type: Number, default: 0 },
  playersBought: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }]
});

// Compound Index: Enforce team names to be uniquely tied strictly to the Room
userSchema.index({ roomId: 1, teamName: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
