const { sendToDialogflow } = require("../service/chat.service");

module.exports = {
  async chat(req, res) {
    try {
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({
          reply: "Vui lòng nhập tin nhắn.",
        });
      }

      // Tạo session ID dựa vào user hoặc random
      const sessionId = req.user?.id || `guest-${Date.now()}`;

      const result = await sendToDialogflow(message, sessionId);

      return res.json(result);
    } catch (error) {
      console.error("Chat controller error:", error);
      return res.status(500).json({
        reply: "Đã xảy ra lỗi, vui lòng thử lại.",
      });
    }
  },
};