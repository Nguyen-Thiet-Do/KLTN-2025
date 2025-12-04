/**
 * Unit tests for src/service/readerService.js
 * Mocks sequelize models and bcrypt.
 * Updated: handle resetReaderPassword behavior (returns {success:false} instead of throwing)
 * Added: suppress console logs during tests to reduce noise
 */

beforeAll(() => {
    // suppress noisy logs from services during tests
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
afterAll(() => {
    console.log.mockRestore?.();
    console.error.mockRestore?.();
});

jest.mock('../model', () => ({
    Account: { findOne: jest.fn(), create: jest.fn(), update: jest.fn() },
    Reader: {
        findAll: jest.fn(),
        findOne: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        sequelize: { transaction: jest.fn(() => ({ commit: jest.fn(), rollback: jest.fn() })) }
    },
    LoanSlip: { getTableName: jest.fn() },
    LoanDetail: { getTableName: jest.fn(), count: jest.fn() },
    MemberCard: {},
    CardType: {}
}));

jest.mock('bcrypt', () => ({
    hash: jest.fn(() => Promise.resolve('hashedpw'))
}));

const readerService = require('../service/readerService');
const { Account, Reader } = require('../model');

describe('readerService - createReader', () => {
    beforeEach(() => jest.clearAllMocks());

    test('missing required fields -> throw', async () => {
        await expect(readerService.createReader({ email: null })).rejects.toThrow();
    });

    test('email already exists -> throw', async () => {
        Account.findOne.mockResolvedValue({ accountId: 1 });
        await expect(
            readerService.createReader({ fullName: 'A', email: 'a@b.com', password: '123456' })
        ).rejects.toThrow('Email đã tồn tại');
    });

    test('phone exists -> throw', async () => {
        // Cấp mock theo thứ tự: 1) check email -> null, 2) check phone -> duplicate
        Account.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ accountId: 2 });

        await expect(
            readerService.createReader({
                fullName: 'A',
                email: 'x@b.com',
                password: '123456',
                phoneNumber: '0123'
            })
        ).rejects.toThrow('Số điện thoại đã tồn tại');
    });

    test('success -> return readerId and accountId', async () => {
        Account.findOne.mockResolvedValue(null);
        Account.create.mockResolvedValue({ accountId: 10 });
        Reader.create.mockResolvedValue({ readerId: 20 });

        const res = await readerService.createReader({
            fullName: 'User',
            email: 'ok@example.com',
            password: '123456'
        });

        expect(res.readerId).toBe(20);
        expect(res.accountId).toBe(10);
    });
});

describe('readerService - updateReader', () => {
    beforeEach(() => jest.clearAllMocks());

    test('reader not found -> return failure', async () => {
        Reader.findByPk.mockResolvedValue(null);
        const res = await readerService.updateReader(1, { fullName: 'New' });
        expect(res.success).toBe(false);
    });

    test('phone duplicate -> return failure', async () => {
        const fakeReader = {
            readerId: 1,
            accountId: 2,
            Account: { phoneNumber: '000' },
            update: jest.fn()
        };

        Reader.findByPk.mockResolvedValue(fakeReader);
        Account.findOne.mockResolvedValue({ accountId: 99 });

        const res = await readerService.updateReader(1, { phoneNumber: '012345' });
        expect(res.success).toBe(false);
    });

    test('email duplicate -> return failure', async () => {
        const fakeReader = {
            readerId: 1,
            accountId: 2,
            Account: { email: 'old@example.com' },
            update: jest.fn()
        };

        Reader.findByPk.mockResolvedValue(fakeReader);
        Account.findOne.mockResolvedValue({ accountId: 99 });

        const res = await readerService.updateReader(1, { email: 'new@example.com' });
        expect(res.success).toBe(false);
    });

    test('success update -> return success true', async () => {
        const fakeReader = {
            readerId: 1,
            accountId: 2,
            Account: { email: 'old@example.com' },
            update: jest.fn()
        };

        Reader.findByPk.mockResolvedValue(fakeReader);
        Account.findOne.mockResolvedValue(null);

        const res = await readerService.updateReader(1, {
            fullName: 'New Name',
            email: 'new@example.com'
        });
        expect(res.success).toBe(true);
    });
});

describe('readerService - resetReaderPassword', () => {
    beforeEach(() => jest.clearAllMocks());

    test('missing password -> return failure object', async () => {
        // Implementation returns { success:false, message: ... } rather than throw
        const res = await readerService.resetReaderPassword(1, '');
        expect(res).toHaveProperty('success', false);
        expect(res).toHaveProperty('message');
        expect(res.message).toMatch(/Mật khẩu mới không hợp lệ/i);
    });

    test('reader not found -> return failure', async () => {
        Reader.findByPk.mockResolvedValue(null);

        const res = await readerService.resetReaderPassword(1, 'newpass');
        expect(res.success).toBe(false);
    });

    test('success -> update password', async () => {
        const fakeReader = { readerId: 1, accountId: 2 };
        Reader.findByPk.mockResolvedValue(fakeReader);
        Account.update.mockResolvedValue([1]);

        const res = await readerService.resetReaderPassword(1, 'newpass123');
        expect(res.success).toBe(true);
    });
});

describe('readerService - lock/unlock', () => {
    beforeEach(() => jest.clearAllMocks());

    test('lockReaderAccount - not found', async () => {
        Reader.findByPk.mockResolvedValue(null);
        const res = await readerService.lockReaderAccount(1);
        expect(res.success).toBe(false);
    });

    test('lockReaderAccount - success', async () => {
        const fakeReader = { readerId: 1, accountId: 2 };
        Reader.findByPk.mockResolvedValue(fakeReader);
        Account.update.mockResolvedValue([1]);

        const res = await readerService.lockReaderAccount(1);
        expect(res.success).toBe(true);
    });

    test('unlockReaderAccount - not found', async () => {
        Reader.findByPk.mockResolvedValue(null);
        const res = await readerService.unlockReaderAccount(1);
        expect(res.success).toBe(false);
    });

    test('unlockReaderAccount - success', async () => {
        const fakeReader = { readerId: 1, accountId: 2 };
        Reader.findByPk.mockResolvedValue(fakeReader);
        Account.update.mockResolvedValue([1]);

        const res = await readerService.unlockReaderAccount(1);
        expect(res.success).toBe(true);
    });
});
