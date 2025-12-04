// src/config/database.js

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Khởi tạo Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    // Timezone
    timezone: '+07:00',
    // Logging
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    // Connection Pool
    pool: {
      max: Number(process.env.DB_CONN_LIMIT) || 10,
      min: 0,
      acquire: Number(process.env.DB_ACQUIRE_TIMEOUT) || 10000,
      idle: Number(process.env.DB_IDLE_TIMEOUT) || 60000,
    },
    
    // Default model options
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },
    
    // Dialect options
    dialectOptions: {
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT) || 10000,
      dateStrings: true,
      typeCast: true,
    },
    
    // Retry
    retry: {
      max: 3,
    },
  }
);

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Kết nối Sequelize thành công');
    
    const [results] = await sequelize.query('SELECT VERSION() as version');
    console.log(`📊 MySQL version: ${results[0].version}`);
    console.log(`🔧 Pool config: max ${sequelize.config.pool.max} connections`);
    
    return true;
  } catch (error) {
    console.error('❌ Kết nối thất bại:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    return false;
  }
};

// Graceful shutdown
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('🛑 Đã đóng Sequelize connection');
  } catch (error) {
    console.error('❌ Lỗi khi đóng connection:', error.message);
  }
};

// Process termination handlers
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

// Test connection on startup
testConnection();

module.exports = sequelize;