const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    discord: 'https://discord.gg/3XDDvZfw',
    telegram: 'https://t.me/@Handikz26',
    github: 'https://github.com/Dikz48',
    email: 'handikads208@gmail.com'
  });
});

module.exports = router;