const Category = require('../model/Category');

async function getAll() {
  const rows = await Category.findAll();
  return rows;
}

module.exports = { getAll };

// tesst