const crypto = require('crypto');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

const { getIO } = require('../socket/socket');

const pool = require('../database/database');

const tableColumns = require('../config/table.columns.json');

const validTables = Object.keys(tableColumns);

const validateTableName = (tableName) => validTables.includes(tableName);

const getPagination = (page, size) => {
    const limit = size ? +size : 20;
    const offset = page ? page * limit : 0;
    return { limit, offset };
};

const controller = {
    login: async (req, res) => {
        const { email, password } = req.body;
        if (!(email && password)) {
            return res.status(400).send("All input is required");
        }
        try {
            const sql = `SELECT * FROM user WHERE email = ?`;
            const [users] = await pool.query(sql, [email]);

            if (users.length) {
                const user = users[0];
                const token = jwt.sign({ user_id: user.id, email }, "GiveMeReason", {
                    expiresIn: "7d",
                });

                return res.status(200).json({ token });
            }
            res.status(400).send("Invalid Credentials");
        } catch (error) {
            console.log(error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    },

    generateQRCode: async (req, res) => {
        try {
            // Generate a unique session ID
            const sessionId = crypto.randomBytes(20).toString('hex');
            const expiresAt = new Date(Date.now() + 5 * 60000);

            // Generate a two-digit authentication number
            const authNumber = Math.floor(Math.random() * 90) + 10;

            // Store the session in the database
            const sql = 'INSERT INTO sessions (session_id, expires_at, correct_number) VALUES (?, ?, ?)';
            await pool.query(sql, [sessionId, expiresAt, authNumber]);

            // Generate a QR code
            const qrCodeURL = await QRCode.toDataURL(sessionId);

            res.json({ qrCodeURL, sessionId, authNumber });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    verifyQRCodeSession: async (req, res) => {
        const { sessionId } = req.body;
        try {
            const sql = 'SELECT * FROM sessions WHERE session_id = ? AND expires_at > NOW()';
            const [rows] = await pool.query(sql, [sessionId]);
            if (rows.length > 0) {
                res.json({ valid: true });
            } else {
                res.status(400).json({ valid: false });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    initiateTwoStepAuth: async (req, res) => {
        const { sessionId } = req.body;
        try {
            const numbers = Array.from({ length: 3 }, () => Math.floor(Math.random() * 90 + 10));

            const correctNumber = numbers[Math.floor(Math.random() * numbers.length)];

            const sql = 'UPDATE sessions SET correct_number = ? WHERE session_id = ?';

            await pool.query(sql, [correctNumber, sessionId]);

            res.json({ numbers });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    finalizeAuthentication: async (req, res) => {
        const { sessionId, selectedNumber } = req.body;
        try {
            const sql = 'SELECT correct_number FROM sessions WHERE session_id = ?';
            const [rows] = await pool.query(sql, [sessionId]);
            if (rows.length > 0 && rows[0].correct_number == selectedNumber) {
                res.json({ authenticated: true });
            } else {
                res.status(400).json({ authenticated: false });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    logout: async (req, res) => {
        try {
            res.status(200).send("Logged out successfully");
        } catch (error) {
            console.log(error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    },

    getAll: async (req, res) => {
        const tableName = req.params.tablename;
        if (!validateTableName(tableName)) {
            return res.status(400).json({ error: "Invalid table name" });
        }

        try {
            let sql, paginationResponse, rows, totalItems, totalPages;
            if (req.query.pg) {
                const page = parseInt(req.query.pg, 10) - 1;
                const { limit, offset } = getPagination(page, 20);
                sql = `SELECT * FROM ?? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
                [rows] = await pool.query(sql, [tableName, limit, offset]);

                const countSql = `SELECT COUNT(*) AS total FROM ??`;
                const [totalResult] = await pool.query(countSql, [tableName]);
                totalItems = totalResult[0].total;
                totalPages = Math.ceil(totalItems / limit);

                paginationResponse = {
                    limit: limit,
                    total: totalItems,
                    page: page + 1,
                    pagetotal: totalPages,
                };
            } else {
                sql = `SELECT * FROM ?? ORDER BY created_at DESC`;
                [rows] = await pool.query(sql, [tableName]);

                totalItems = rows.length;
                totalPages = 1;

                paginationResponse = {
                    limit: 0,
                    total: totalItems,
                    page: 0,
                    pagetotal: totalPages,
                };
            }

            const response = {
                ...paginationResponse,
                [tableName]: rows
            };

            res.json(response);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    getById: async (req, res) => {
        const tableName = req.params.tablename;
        if (!validateTableName(tableName)) {
            return res.status(400).json({ error: "Invalid table name" });
        }
        try {
            const { id } = req.params;
            const sql = `SELECT * FROM ${tableName} WHERE id = ?`;
            const [rows] = await pool.query(sql, [id]);
            if (rows.length === 0) {
                return res.status(404).json({ error: "Data not found" });
            }
            res.json(rows[0]);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    create: async (req, res) => {
        const io = getIO();
        const tableName = req.params.tablename;
        if (!validateTableName(tableName)) {
            return res.status(400).json({ error: "Invalid table name" });
        }
        try {
            const requestBody = req.body;
            const keys = Object.keys(requestBody);
            const values = Object.values(requestBody);
            const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${Array(keys.length).fill('?').join(', ')})`;
            const [result] = await pool.query(sql, values);

            io.emit('dataCreated', { table: tableName, data: requestBody });

            res.json({ message: "Data created successfully", new_id: result.insertId });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    update: async (req, res) => {
        const io = getIO();
        const tableName = req.params.tablename;
        if (!validateTableName(tableName)) {
            return res.status(400).json({ error: "Invalid table name" });
        }
        try {
            const { id } = req.params;
            const requestBody = req.body;

            if (Object.keys(requestBody).length === 0) {
                return res.status(400).json({ error: "No fields provided for update" });
            }

            const setFields = Object.keys(requestBody).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(requestBody), id];

            const sql = `UPDATE ${tableName} SET ${setFields} WHERE id = ?`;
            const [result] = await pool.query(sql, values);
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Data not found or no changes applied" });
            }

            io.emit('dataUpdated', { table: tableName, id: id, data: requestBody });

            res.json({ message: "Data updated successfully" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    delete: async (req, res) => {
        const io = getIO();
        const tableName = req.params.tablename;
        if (!validateTableName(tableName)) {
            return res.status(400).json({ error: "Invalid table name" });
        }
        try {
            const { id } = req.params;
            const sql = `DELETE FROM ${tableName} WHERE id = ?`;
            const [result] = await pool.query(sql, [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Data not found" });
            }

            io.emit('dataDeleted', { table: tableName, id: id });

            res.json({ message: "Data deleted successfully" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
};

module.exports = controller;
