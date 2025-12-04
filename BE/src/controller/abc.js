const testService = require('../service/test');

async function getAll(req, res, next) {
  try {
    const data = await testService.getAll();
    res.json(data);
  } catch (err) {
    next(err);
  }
}
// test
module.exports = { getAll };