const express = require('express');
const cors = require('cors');
require('dotenv').config();

const usersRouter = require('./app/routes/users.routes');
const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api/v1/user', usersRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}/`);
});