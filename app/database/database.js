const mysql = require('mysql2');
const config = require('../config/config')
// require('dotenv').config();

const pool = mysql.createConnection({
    host: config.host,
    database: config.database,
    user: config.username,
    password: config.password,
    port: config.port
});

module.exports = pool.promise();