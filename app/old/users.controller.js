const pool = require('../database/database')

const usersController = {
    getAll: async (req, res) => {
        try {
            const sql = "SELECT * FROM user ORDER BY created_at DESC";
            const [users, fields] = await pool.query(sql);
            res.json(users);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    getById: async (req, res) => {
        try {
            const { id } = req.params
            const [user, fields] = await pool.query("SELECT * FROM user where customer_id = ?", [id]);
            if (user.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }
            res.json(user[0]);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    create: async (req, res) => {
        try {
            const requestBody = req.body;
            const keys = Object.keys(requestBody);
            const values = Object.values(requestBody);
            const sql = `INSERT INTO user (${keys.join(', ')}) VALUES (${Array(keys.length).fill('?').join(', ')})`;
            const [result, fields] = await pool.query(sql, values);

            res.json({ message: "User created successfully", user_id: result.insertId });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const requestBody = req.body;

            if (Object.keys(requestBody).length === 0) {
                return res.status(400).json({ error: "No fields provided for update" });
            }

            const setFields = Object.keys(requestBody).map(key => `${key} = ?`).join(', ');
            const values = Object.values(requestBody);
            values.push(id);

            const sql = `UPDATE user SET ${setFields} WHERE customer_id = ?`;
            const [result, fields] = await pool.query(sql, values);
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "User not found or no changes applied" });
            }
            res.json({ message: "User updated successfully" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const sql = "DELETE FROM user WHERE customer_id = ?";
            const [result, fields] = await pool.query(sql, [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "User not found" });
            }
            res.json({ message: "User deleted successfully" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}

module.exports = usersController