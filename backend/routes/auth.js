const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

router.post('/create-room', async (req, res) => {
  const { username, teamName } = req.body;
  if (!username || !teamName) return res.status(400).json({ message: 'Name and Team Name required' });

  try {
    const roomId = generateRoomCode();
    
    // Create the host user
    const user = await User.create({
      username,
      teamName,
      roomId,
      isHost: true
    });

    res.status(200).json({
      _id: user._id,
      username: user.username,
      teamName: user.teamName,
      roomId: user.roomId,
      budget: user.budget,
      isHost: user.isHost,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/join-room', async (req, res) => {
  const { username, teamName, roomId } = req.body;
  if (!username || !teamName || !roomId) return res.status(400).json({ message: 'All fields required' });

  try {
    // Check if teamName already exists inside this specific room
    let user = await User.findOne({ roomId, teamName });
    if (user) {
      return res.status(400).json({ message: `Team '${teamName}' is already taken in this room!` });
    }

    user = await User.create({
      username,
      teamName,
      roomId,
      isHost: false // Guests are never hosts
    });

    res.status(200).json({
      _id: user._id,
      username: user.username,
      teamName: user.teamName,
      roomId: user.roomId,
      budget: user.budget,
      isHost: user.isHost,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id).populate('playersBought').select('-password');
    res.json(user);
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
