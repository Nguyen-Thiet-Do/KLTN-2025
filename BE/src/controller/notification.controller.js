// src/controller/notification.controller.js
const NotificationService = require('../service/notification.service');
const { Reader } = require('../model'); // đảm bảo Reader được export trong ../model/index.js

/**
 * Utility async: lấy readerId theo thứ tự ưu tiên:
 * 1) req.user.readerId (nếu token đã chứa)
 * 2) nếu token có accountId nhưng không có readerId -> lookup Reader.findOne({ accountId })
 * 3) cuối cùng fallback req.query.readerId (nếu có)
 *
 * Trả về null nếu không tìm thấy.
 */
async function resolveReaderId(req) {
    // 1) token chứa readerId trực tiếp
    const fromTokenReader = req.user?.readerId;
    if (typeof fromTokenReader !== 'undefined' && fromTokenReader !== null && String(fromTokenReader) !== '') {
        const n = Number(fromTokenReader);
        return Number.isFinite(n) ? n : null;
    }

    // 2) token có accountId -> lookup Reader
    const accountId = req.user?.accountId;
    if (typeof accountId !== 'undefined' && accountId !== null && String(accountId) !== '') {
        const acctNum = Number(accountId);
        if (Number.isFinite(acctNum)) {
            try {
                const r = await Reader.findOne({ where: { accountId: acctNum } });
                if (r && r.readerId) return Number(r.readerId);
            } catch (err) {
                // không throw để không phá flow; log để debug nếu cần
                console.warn('resolveReaderId: lookup Reader by accountId failed:', err.message);
            }
        }
    }

    // 3) fallback query param
    const fromQuery = req.query?.readerId;
    if (typeof fromQuery !== 'undefined' && fromQuery !== null && String(fromQuery) !== '') {
        const n = Number(fromQuery);
        return Number.isFinite(n) ? n : null;
    }

    return null;
}

async function listNotifications(req, res, next) {
    try {
        const readerId = await resolveReaderId(req); // now async

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const q = {
            readerId,
            page: Math.max(1, page),
            limit: Math.min(200, Math.max(1, limit)),
            isRead: (typeof req.query.isRead !== 'undefined' && req.query.isRead !== '') ? req.query.isRead : undefined, // '0' | '1' | undefined
            q: req.query.q, // search
            sortBy: req.query.sortBy || 'created_at',
            sortDir: (req.query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
        };

        const result = await NotificationService.list(q);
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
}

async function getNotification(req, res, next) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'notification id không hợp lệ' });

        const readerId = await resolveReaderId(req);
        const rec = await NotificationService.getById({ notificationID: id, readerId });
        if (!rec) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });

        res.json({ success: true, data: rec });
    } catch (err) {
        next(err);
    }
}

async function markRead(req, res, next) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'notification id không hợp lệ' });

        const readerId = await resolveReaderId(req);
        const rec = await NotificationService.markRead({ notificationID: id, readerId });
        if (!rec) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo để đánh dấu đã đọc' });

        res.json({ success: true, data: rec });
    } catch (err) {
        next(err);
    }
}

async function markUnread(req, res, next) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'notification id không hợp lệ' });

        const readerId = await resolveReaderId(req);
        const rec = await NotificationService.markUnread({ notificationID: id, readerId });
        if (!rec) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo để đánh dấu chưa đọc' });

        res.json({ success: true, data: rec });
    } catch (err) {
        next(err);
    }
}

async function markAllRead(req, res, next) {
    try {
        const readerId = await resolveReaderId(req);
        if (!readerId) {
            // Không an toàn nếu cho phép null -> có thể update toàn bộ bản ghi
            return res.status(400).json({ success: false, message: 'readerId required để đánh dấu tất cả đã đọc' });
        }

        const count = await NotificationService.markAllRead({ readerId });
        res.json({ success: true, updated: count });
    } catch (err) {
        next(err);
    }
}

// Optional admin create (body: { readerId, type, title, content, link, priority })
async function createNotification(req, res, next) {
    try {
        const payload = req.body || {};

        // validation cơ bản
        const readerId = payload.readerId || await resolveReaderId(req);
        if (!readerId) {
            return res.status(400).json({ success: false, message: 'readerId là bắt buộc' });
        }
        if (!payload.title || String(payload.title).trim() === '') {
            return res.status(400).json({ success: false, message: 'title là bắt buộc' });
        }

        // chuẩn hoá payload tối thiểu
        const createPayload = {
            readerId: Number(readerId),
            type: payload.type || 'SYSTEM',
            title: String(payload.title).slice(0, 200),
            content: payload.content || null,
            link: payload.link || null,
            priority: payload.priority || 'NORMAL'
        };

        const rec = await NotificationService.create(createPayload);

        // realtime push nếu socket tồn tại
        try {
            if (global.io && rec) {
                const room = `user_${rec.readerId}`;
                global.io.to(room).emit('notification:new', rec);
            }
        } catch (e) {
            console.error('socket emit error', e);
        }

        res.status(201).json({ success: true, data: rec });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listNotifications,
    getNotification,
    markRead,
    markUnread,
    markAllRead,
    createNotification
};
