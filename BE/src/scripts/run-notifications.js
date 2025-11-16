// src/scripts/run-notifications.js
require('dotenv').config();
const sequelize = require('../config/database');
const { runNotificationJob } = require('../service/notificationJob.service');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('DB connected for scheduled job');
    await runNotificationJob(); // chạy 1 lần
    await sequelize.close();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Scheduled job error', err);
    try { await sequelize.close(); } catch(e) {}
    process.exit(1);
  }
}

main();
