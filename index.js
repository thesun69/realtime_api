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
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

module.exports.io = io;

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}/api/v1/user`);
});

// server.listen(PORT, '192.168.56.1', () => {
//     console.log(`Server is running on http://192.168.56.1:${PORT}/api/v1/user`);
// });
