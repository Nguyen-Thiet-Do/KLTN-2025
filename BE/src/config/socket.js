let io = null;

function initSocket(server) {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    // Client gửi userId sau khi login
    socket.on("register", (userId) => {
      if (!userId) return;

      const room = `user_${userId}`;
      socket.join(room);

      console.log(`📌 Socket ${socket.id} joined room ${room}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });
}

function emitToUser(userId, event, data) {
  if (!io) {
    console.error("❌ Socket.IO chưa sẵn sàng");
    return;
  }

  const room = `user_${userId}`;
  io.to(room).emit(event, data);

  console.log(`🚀 Event "${event}" sent to ${room}`);
}

module.exports = { initSocket, emitToUser };
