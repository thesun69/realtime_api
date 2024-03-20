const crypto = require('crypto');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const { getIO } = require('../socket/socket');
const pool = require('../database/database');

const tableColumns = require('../config/table.columns.json');
const serviceAccount = require('../config/omcup-6e21e-firebase-adminsdk-m1nle-1b1da6c90c.json');

const validTables = Object.keys(tableColumns);

const validateTableName = (tableName) => validTables.includes(tableName);

const getPagination = (page, size) => {
    const limit = size ? +size : 20;
    const offset = page ? page * limit : 0;
    return { limit, offset };
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

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

                return res.status(200).json({ id: user.id, token });
            }
            res.status(400).send("Invalid Credentials");
        } catch (error) {
            console.log(error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    },

    generateQRCode: async (req, res) => {
        try {
            const sessionId = crypto.randomBytes(20).toString('hex');
            const expiresAt = new Date(Date.now() + 5 * 60000);
            const authNumber = Math.floor(Math.random() * 90) + 10;
            const otherNumber = Math.floor(Math.random() * 90) + 10;
            const otherNumber2 = Math.floor(Math.random() * 90) + 10;

            const sql = 'INSERT INTO sessions (session_id, expires_at, correct_number, other_number1, other_number2) VALUES(?, ?, ?, ?, ?)';

            await pool.query(sql, [sessionId, expiresAt, authNumber, otherNumber, otherNumber2]);

            const qrCodeURL = await QRCode.toDataURL(sessionId);

            res.json({ qrCodeURL, sessionId, authNumber, otherNumber, otherNumber2 });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    shuffleArray: array => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },

    initiateTwoStepAuth: async (req, res) => {
        const { sessionId } = req.body;
        try {
            const getNumbersSql = 'SELECT correct_number, other_number1, other_number2 FROM sessions WHERE session_id = ?';
            const [rows] = await pool.query(getNumbersSql, [sessionId]);
            if (rows.length > 0) {
                const { correct_number, other_number1, other_number2 } = rows[0];
                let numbers = [correct_number, other_number1, other_number2];
                controller.shuffleArray(numbers);
                res.json({ numbers });
            } else {
                res.status(400).json({ error: 'Session not found or expired' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    finalizeAuthentication: async (req, res) => {
        const { sessionId, selectedNumber, userId } = req.body;
        try {
            const sql = 'SELECT correct_number FROM sessions WHERE session_id = ?';
            const [rows] = await pool.query(sql, [sessionId]);
            if (rows.length > 0 && rows[0].correct_number == selectedNumber) {
                const updateSql = 'UPDATE sessions SET `user_id`= ?, verified = 1 WHERE session_id = ?';
                await pool.query(updateSql, [userId, sessionId]);
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

        const { c, d, pg } = req.query;

        try {
            let sql, whereClause = '', queryParams = [tableName], paginationResponse, rows, totalItems, totalPages;

            if (c && d) {
                whereClause = ' WHERE ?? = ?';
                queryParams.push(c, d);
            }

            let baseSql = `SELECT * FROM ??${whereClause} ORDER BY created_at DESC`;

            if (pg) {
                const page = parseInt(pg, 10) - 1;
                const { limit, offset } = getPagination(page, 20);
                sql = `${baseSql} LIMIT ? OFFSET ?`;
                queryParams.push(limit, offset);

                [rows] = await pool.query(sql, queryParams);

                const countSql = `SELECT COUNT(*) AS total FROM ??${whereClause}`;
                const [totalResult] = await pool.query(countSql, queryParams.slice(0, queryParams.length - 2)); // Exclude limit and offset
                totalItems = totalResult[0].total;
                totalPages = Math.ceil(totalItems / limit);

                paginationResponse = {
                    limit: limit,
                    total: totalItems,
                    page: page + 1,
                    pagetotal: totalPages,
                };
            } else {
                sql = baseSql;
                [rows] = await pool.query(sql, queryParams);

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

    // getAll: async (req, res) => {
    //     const tableName = req.params.tablename;
    //     if (!validateTableName(tableName)) {
    //         return res.status(400).json({ error: "Invalid table name" });
    //     }

    //     try {
    //         let sql, paginationResponse, rows, totalItems, totalPages;
    //         if (req.query.pg) {
    //             const page = parseInt(req.query.pg, 10) - 1;
    //             const { limit, offset } = getPagination(page, 20);
    //             sql = `SELECT * FROM ?? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    //             [rows] = await pool.query(sql, [tableName, limit, offset]);

    //             const countSql = `SELECT COUNT(*) AS total FROM ??`;
    //             const [totalResult] = await pool.query(countSql, [tableName]);
    //             totalItems = totalResult[0].total;
    //             totalPages = Math.ceil(totalItems / limit);

    //             paginationResponse = {
    //                 limit: limit,
    //                 total: totalItems,
    //                 page: page + 1,
    //                 pagetotal: totalPages,
    //             };
    //         } else {
    //             sql = `SELECT * FROM ?? ORDER BY created_at DESC`;
    //             [rows] = await pool.query(sql, [tableName]);

    //             totalItems = rows.length;
    //             totalPages = 1;

    //             paginationResponse = {
    //                 limit: 0,
    //                 total: totalItems,
    //                 page: 0,
    //                 pagetotal: totalPages,
    //             };
    //         }

    //         const response = {
    //             ...paginationResponse,
    //             [tableName]: rows
    //         };

    //         res.json(response);
    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).json({ error: "Internal Server Error" });
    //     }
    // },

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
    },

    sendNotiAll: async (req, res) => {
        const { title, body } = req.body;

        if (!title || !body) {
            return res.status(400).send({ success: false, message: 'Title and body are required.' });
        }
        const message = {
            notification: {
                title: title,
                body: body
            },
            topic: 'all'
        };

        try {
            const response = await admin.messaging().send(message);
            console.log('Successfully sent message:', response);
            res.status(200).send({ status: "Success", success: true, message: 'Notification sent successfully', response });
        } catch (error) {
            console.log('Error sending message:', error);
            res.status(500).send({ status: "Failed", success: false, message: 'Failed to send notification', error });
        }
    }
};

module.exports = controller;
