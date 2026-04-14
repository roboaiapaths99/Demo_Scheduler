const CryptoJS = require('crypto-js');

// Use a strong encryption key (in production, use env variables)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-super-secret-encryption-key-min-32-chars-required';

// Encrypt sensitive data
const encrypt = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

// Decrypt sensitive data
const decrypt = (encryptedData) => {
  try {
    if (!encryptedData) return null;
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Hash sensitive data (one-way encryption)
const hash = (data) => {
  return CryptoJS.SHA256(data).toString();
};

// Verify hashed data
const verifyHash = (data, hash) => {
  return CryptoJS.SHA256(data).toString() === hash;
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  verifyHash
};
