const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    connectionLimit: 790,
    connectTimeout: 90000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Successfully connected to the database');
    connection.release();
});

// Promise wrapper so routes can use async/await
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

const queryOne = async (sql, params = []) => {
    const rows = await query(sql, params);
    return rows[0] || null;
};

module.exports = { pool, query, queryOne };
