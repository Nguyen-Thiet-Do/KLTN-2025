// src/route/debugJob.routes.js
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");

// middleware bảo vệ
const { requireAuth, requireRole } = require('../middleware/auth');

// services
const { runNotificationJob } = require("../service/notificationJob.service");
const { Notification } = require("../model");

// Helper extract slip id
function extractSlipIdFromContent(content) {
    if (!content) return null;
    const m = String(content).match(/Slip[:\s]*([0-9]+)/i);
    return m ? m[1] : null;
}

// SIMPLE TRIGGER
router.post(
    "/run-notification-job",
    requireAuth,
    requireRole([1]), // chỉ admin (roleId=1)
    async (req, res) => {
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
    }
);


// FULL VERSION DEBUG
router.post(
    "/run-notification-job/full",
    requireAuth,
    requireRole([1]), // chỉ admin
    async (req, res) => {
        try {
            console.log("🚀 [DEBUG] Manual trigger runNotificationJob() (full) - start");
            const startTime = new Date();

            await runNotificationJob();

            const endTime = new Date();

            const notifications = await Notification.findAll({
                where: {
                    [Op.or]: [
                        { created_at: { [Op.gte]: startTime } },
                        { emailAt: { [Op.between]: [startTime, endTime] } }
                    ]
                },
                order: [["created_at", "DESC"]],
                limit: 500
            });

            // try load buildItemsForSlip
            let buildItemsForSlip = null;
            try {
                const svc = require("../service/notificationJob.service");
                buildItemsForSlip = svc.buildItemsForSlip || null;
            } catch (e) {
                buildItemsForSlip = null;
            }

            const enriched = await Promise.all(
                notifications.map(async (n) => {
                    const simple = {
                        notificationID: n.notificationID,
                        readerId: n.readerId,
                        type: n.type,
                        title: n.title,
                        content: n.content,
                        created_at: n.created_at,
                        emailAt: n.emailAt
                    };

                    const slipId = extractSlipIdFromContent(n.content);
                    if (slipId && typeof buildItemsForSlip === "function") {
                        try {
                            simple.items = await buildItemsForSlip(slipId);
                        } catch (e) {
                            simple.items = null;
                            simple.itemsError = String(e);
                        }
                    } else {
                        simple.items = null;
                    }

                    return simple;
                })
            );

            console.log(
                `✅ [DEBUG] run-notif-full: start=${startTime.toISOString()} end=${endTime.toISOString()} found=${enriched.length}`
            );

            return res.json({
                success: true,
                startTime,
                endTime,
                count: enriched.length,
                notifications: enriched
            });
        } catch (err) {
            console.error("❌ [DEBUG] runNotificationJob(full) error:", err);
            return res.status(500).json({ success: false, error: err.message || String(err) });
        }
    }
);

module.exports = router;
