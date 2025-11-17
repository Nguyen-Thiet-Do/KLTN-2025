// src/route/debugJob.routes.js
const express = require("express");
const router = express.Router();

const { runNotificationJob } = require("../service/notificationJob.service");

router.post("/run-notification-job", async (req, res) => {
    try {
        console.log("🚀 [DEBUG] Manual trigger runNotificationJob()");
        await runNotificationJob();
        return res.json({
            success: true,
            message: "runNotificationJob() executed successfully!"
        });
    } catch (err) {
        console.error("❌ [DEBUG] runNotificationJob() error:", err);
        return res.status(500).json({
            success: false,
            error: err.message || String(err)
        });
    }
});

module.exports = router;
