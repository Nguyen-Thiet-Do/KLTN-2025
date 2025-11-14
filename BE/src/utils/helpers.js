// src/utils/helpers.js
function generateRandomCode(len = 6) {
  const min = Math.pow(10, len-1);
  const max = Math.pow(10, len) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCardNumber() {
  return 'C' + Date.now().toString().slice(-12);
}

module.exports = { generateRandomCode, generateCardNumber };
