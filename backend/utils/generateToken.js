const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'agroconnect_secret_key_change_this',
    { expiresIn: '7d' }
  );
};

module.exports = generateToken;
