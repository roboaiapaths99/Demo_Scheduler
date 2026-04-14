const jwt = require('jsonwebtoken');

// Generate JWT Access Token
const generateAccessToken = (userId) => {
  return jwt.sign(
    { 
      userId,
      type: 'access'
    },
    process.env.JWT_ACCESS_SECRET,
    { 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' 
    }
  );
};

// Generate JWT Refresh Token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { 
      userId,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
    }
  );
};

// Verify JWT Token
const verifyToken = (token, tokenType = 'access') => {
  const secret = tokenType === 'refresh' ? process.env.JWT_REFRESH_SECRET : process.env.JWT_ACCESS_SECRET;
  
  return jwt.verify(token, secret);
};

// Generate token pair
const generateTokenPair = (userId) => {
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId)
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateTokenPair
};
