// src/service/notification.service.js
const { Op } = require('sequelize');
const { Notification } = require('../model'); // tùy cấu trúc export của bạn
const ONE_PAGE_MAX = 200;

async function list({ readerId, page = 1, limit = 20, isRead, q, sortBy = 'created_at', sortDir = 'DESC' }) {
  page = Math.max(1, Number(page));
  limit = Math.min(ONE_PAGE_MAX, Math.max(1, Number(limit)));

  const where = {};
  if (readerId) where.readerId = Number(readerId);
  if (typeof isRead !== 'undefined' && isRead !== null && String(isRead) !== '') {
    // accept '0'/'1' or 0/1
    where.isRead = Number(isRead) ? 1 : 0;
  }
  if (q && String(q).trim()) {
    const s = `%${String(q).trim()}%`;
    where[Op.or] = [
      { title: { [Op.like]: s } },
      { content: { [Op.like]: s } }
    ];
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [[sortBy, sortDir]],
    limit,
    offset
  });

  return {
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    data: rows
  };
}

async function getById({ notificationID, readerId }) {
  const where = { notificationID: Number(notificationID) };
  if (readerId) where.readerId = Number(readerId);
  const rec = await Notification.findOne({ where });
  return rec;
}

async function markRead({ notificationID, readerId }) {
  const where = { notificationID: Number(notificationID) };
  if (readerId) where.readerId = Number(readerId);
  const rec = await Notification.findOne({ where });
  if (!rec) return null;
  await rec.update({ isRead: 1, readAt: new Date() });
  return rec;
}

async function markUnread({ notificationID, readerId }) {
  const where = { notificationID: Number(notificationID) };
  if (readerId) where.readerId = Number(readerId);
  const rec = await Notification.findOne({ where });
  if (!rec) return null;
  await rec.update({ isRead: 0, readAt: null });
  return rec;
}

async function markAllRead({ readerId }) {
  if (!readerId) throw new Error('readerId required');
  const [count] = await Notification.update(
    { isRead: 1, readAt: new Date() },
    { where: { readerId: Number(readerId), isRead: 0 } }
  );
  return count;
}

async function create({ readerId, type = 'SYSTEM', title, content, link = null, priority = 'NORMAL' }) {
  if (!readerId) throw new Error('readerId is required');
  const rec = await Notification.create({
    readerId: Number(readerId),
    type,
    title: title ? String(title).slice(0, 200) : null,
    content: content || null,
    priority,
    link,
    isRead: 0,
    readAt: null,
    emailAt: null
  });
  return rec;
}

module.exports = {
  list,
  getById,
  markRead,
  markUnread,
  markAllRead,
  create
};
