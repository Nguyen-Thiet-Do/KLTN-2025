/**
 * Unit tests for src/service/librarianService.js
 * Mocks sequelize models and bcrypt.
 * Updated: handle resetLibrarianPassword behavior (returns {success:false} instead of throwing)
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
    Librarian: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        sequelize: { transaction: jest.fn(() => ({ commit: jest.fn(), rollback: jest.fn() })) }
    }
}));

jest.mock('bcrypt', () => ({
    hash: jest.fn(() => Promise.resolve('hashedpw'))
}));

const librarianService = require('../service/librarianService');
const { Account, Librarian } = require('../model');

describe('librarianService - createLibrarian', () => {
    beforeEach(() => jest.clearAllMocks());

    test('missing required fields -> throw', async () => {
        await expect(librarianService.createLibrarian({ email: null })).rejects.toThrow();
    });

    test('email exists -> throw', async () => {
        Account.findOne.mockResolvedValue({ accountId: 1 });

        await expect(
            librarianService.createLibrarian({
                fullName: 'A',
                email: 'a@b.com',
                password: '123456'
            })
        ).rejects.toThrow('Email đã tồn tại');
    });

    test('phone exists -> throw', async () => {
        Account.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ accountId: 2 });

        await expect(
            librarianService.createLibrarian({
                fullName: 'A',
                email: 'x@b.com',
                password: '123456',
                phoneNumber: '0123'
            })
        ).rejects.toThrow('Số điện thoại đã tồn tại');
    });

    test('success -> returns librarianId and accountId', async () => {
        Account.findOne.mockResolvedValue(null);
        Account.create.mockResolvedValue({ accountId: 11 });
        Librarian.create.mockResolvedValue({ librarianId: 21 });

        const res = await librarianService.createLibrarian({
            fullName: 'Lib',
            email: 'lib@example.com',
            password: '123456'
        });

        expect(res.success).toBe(true);
        expect(res.librarianId).toBe(21);
    });
});

describe('librarianService - updateLibrarian', () => {
    beforeEach(() => jest.clearAllMocks());

    test('not found -> return failure', async () => {
        Librarian.findByPk.mockResolvedValue(null);

        const res = await librarianService.updateLibrarian(1, { fullName: 'X' });
        expect(res.success).toBe(false);
    });

    test('phone duplicate -> return failure', async () => {
        const fakeLib = {
            librarianId: 1,
            accountId: 2,
            Account: { phoneNumber: '000' }
        };

        Librarian.findByPk.mockResolvedValue(fakeLib);
        Account.findOne.mockResolvedValue({ accountId: 99 });

        const res = await librarianService.updateLibrarian(1, { phoneNumber: '0123' });
        expect(res.success).toBe(false);
    });

    test('success update -> return success true', async () => {
        const fakeLib = {
            librarianId: 1,
            accountId: 2,
            Account: { phoneNumber: '000' }
        };

        Librarian.findByPk.mockResolvedValue(fakeLib);
        Account.findOne.mockResolvedValue(null);

        const res = await librarianService.updateLibrarian(1, {
            fullName: 'New Name',
            phoneNumber: '0123'
        });

        expect(res.success).toBe(true);
    });
});

describe('librarianService - resetLibrarianPassword', () => {
    beforeEach(() => jest.clearAllMocks());

    test('missing new password -> return failure object', async () => {
        const res = await librarianService.resetLibrarianPassword(1, '');
        expect(res).toHaveProperty('success', false);
        expect(res).toHaveProperty('message');
        expect(res.message).toMatch(/Mật khẩu mới không hợp lệ/i);
    });

    test('librarian not found -> fail', async () => {
        Librarian.findByPk.mockResolvedValue(null);

        const res = await librarianService.resetLibrarianPassword(1, 'newpass');
        expect(res.success).toBe(false);
    });

    test('success -> update password', async () => {
        const fakeLib = { librarianId: 1, accountId: 2 };
        Librarian.findByPk.mockResolvedValue(fakeLib);
        Account.update.mockResolvedValue([1]);

        const res = await librarianService.resetLibrarianPassword(1, 'newpass123');
        expect(res.success).toBe(true);
    });
});

describe('librarianService - delete/restore', () => {
    beforeEach(() => jest.clearAllMocks());

    test('delete - not found -> return false', async () => {
        Librarian.findByPk.mockResolvedValue(null);
        const res = await librarianService.deleteLibrarian(1);
        expect(res).toBe(false);
    });

    test('delete - success -> return true', async () => {
        const fakeLib = { librarianId: 2, accountId: 3 };

        Librarian.findByPk.mockResolvedValue(fakeLib);
        Librarian.update.mockResolvedValue([1]);
        Account.update.mockResolvedValue([1]);

        const res = await librarianService.deleteLibrarian(2);
        expect(res).toBe(true);
    });

    test('restore - not found -> return false', async () => {
        Librarian.findByPk.mockResolvedValue(null);
        const res = await librarianService.restoreLibrarian(1);
        expect(res).toBe(false);
    });

    test('restore - success -> return true', async () => {
        const fakeLib = { librarianId: 2, accountId: 3 };

        Librarian.findByPk.mockResolvedValue(fakeLib);
        Librarian.update.mockResolvedValue([1]);
        Account.update.mockResolvedValue([1]);

        const res = await librarianService.restoreLibrarian(2);
        expect(res).toBe(true);
    });
});
