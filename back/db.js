const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '10.150.0.10',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'service_se1',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

module.exports = promisePool;