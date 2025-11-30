const { sendToDialogflow } = require("../service/chat.service");

module.exports = {
  async chat(req, res) {
    const { message } = req.body;

    const reply = await sendToDialogflow(message, "session-1");

    return res.json({ reply });
  },
};
