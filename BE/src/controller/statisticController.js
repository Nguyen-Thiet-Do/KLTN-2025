const statisticService = require("../service/statisticService");

const getAllStatistics = async (req, res) => {
  try {
    const data = await statisticService.getLibraryStatistics();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMonthlyStatistics = async (req, res) => {
  try {
    const data = await statisticService.getMonthlyLoans();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllStatistics, getMonthlyStatistics };
