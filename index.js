const express = require('express');
const http = require('http');
const cors = require('cors');
const router = require('./app/routes/routes');
const socketIo = require('./app/socket/socket');
const app = express();
const server = http.createServer(app);

const io = socketIo.init(server);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api/v1', router);

io.on('connection', (socket) => {

    console.log('New client connected');

    const generateThreeRandomNumbers = () => {
        let numbers = [];
        for (let i = 0; i < 3; i++) {
            numbers.push(Math.floor(Math.random() * 90) + 10);
        }
        return numbers;
    };

    const verifyNumber = async (sessionId, selectedNumber) => {
        return true;
    };

    socket.on('qrScanned', async ({ sessionId, userId }) => {
        const numbers = generateThreeRandomNumbers();
        io.to(socket.id).emit('twoStepAuth', { numbers });
    });

    socket.on('numberSelected', async ({ sessionId, selectedNumber }) => {
        const isValid = await verifyNumber(sessionId, selectedNumber);
        if (isValid) {
            io.to(socket.id).emit('authSuccess', { message: 'Authentication successful' });
        } else {
            io.to(socket.id).emit('authFailed', { message: 'Authentication failed' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

module.exports.io = io;

const PORT = process.env.PORT || 8008;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}/api/v1/user`);
});