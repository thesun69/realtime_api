const express = require("express");
const http = require("http");
const cors = require("cors");
const router = require("./app/routes/routes");
const fs = require("fs");
const { initSocketServer } = require("./app/socket/socket");

const app = express();

const server = http.createServer(app);

const io = initSocketServer(server);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/api/v1", router);

io.on("connection", (socket) => {
  console.log("New client connected");

  const verifyNumber = async (sessionId, selectedNumber, userId) => {
    return true;
  };

  socket.on("qrScanned", async ({ sessionId }) => {
    console.log(`QR Scanned event received with sessionId: ${sessionId}`);
    setTimeout(() => {
      io.to(socket.id).emit("twoStepAuth", sessionId);
      console.log(
        "twoStepAuth event sent to client with sessionId:",
        sessionId
      );
    }, 1000);
  });

  socket.on("numberSelected", async ({ sessionId, selectedNumber, userId }) => {
    const isValid = await verifyNumber(sessionId, selectedNumber, userId);
    if (isValid) {
      io.to(socket.id).emit("authSuccess", {
        message: "Authentication successful",
      });
    } else {
      io.to(socket.id).emit("authFailed", { message: "Authentication failed" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 8010;

server.listen(PORT, () => {
  console.log(
    `Server is running on http://localhost:${PORT}/api/v1/addon_type`
  );
});

// server.listen(PORT, () => {
//   console.log(
//     `Server is running on http://localhost:${PORT}/api/v1/addon_type`
//   );
// });
// server.listen(PORT, '192.168.1.54', () => {
//   console.log(`Server is running on http://192.168.1.54:${PORT}/api/v1/addon_type`);
// });
