/**
 * documentAdminService.test.js
 */

jest.resetModules();

// Mocks cho model (đường dẫn ../model)
const mockDocument = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  count: jest.fn()
};
const mockDocumentCopy = {
  findByPk: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  bulkCreate: jest.fn(),
  update: jest.fn()
};
const mockCategory = { findByPk: jest.fn(), findAll: jest.fn() };
const mockGenre = { findAll: jest.fn() };
const mockDocumentAuthorMap = { bulkCreate: jest.fn(), update: jest.fn() };
const mockDocumentGenreMap = { bulkCreate: jest.fn(), update: jest.fn() };

jest.doMock('../model', () => ({
  Document: mockDocument,
  DocumentCopy: mockDocumentCopy,
  Category: mockCategory,
  Genre: mockGenre,
  DocumentAuthorMap: mockDocumentAuthorMap,
  DocumentGenreMap: mockDocumentGenreMap
}));

// Mock config/database with transaction LOCK
jest.doMock('../config/database', () => ({
  transaction: (cb) => {
    const t = { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
    return Promise.resolve(cb(t));
  },
  literal: (s) => s
}));

// Mock r2Service if used
jest.doMock('../service/r2Service', () => ({
  uploadCover: jest.fn(async () => ({ key: 'covers/test.webp' })),
  uploadEbook: jest.fn(async () => ({ key: 'ebooks/test.pdf' }))
}));

// Safe import of service (support both default and module.exports)
const _admin = require('../service/documentAdminService');
const adminService = _admin && (_admin.default || _admin);

beforeEach(() => {
  // reset mocks and defaults
  jest.clearAllMocks();

  mockDocument.findByPk.mockResolvedValue(null);
  mockDocument.findOne.mockResolvedValue(null);
  mockDocument.findAll.mockResolvedValue([]);
  mockDocument.update.mockResolvedValue([0]);
  mockDocument.count.mockResolvedValue(0);

  mockDocumentCopy.findAll.mockResolvedValue([]);
  mockDocumentCopy.bulkCreate.mockResolvedValue([]);
  mockDocumentCopy.create.mockResolvedValue(null);

  mockGenre.findAll.mockResolvedValue([]);
});

describe('documentAdminService - getDocumentCopy', () => {
  test('khi không tìm thấy -> trả về null', async () => {
    mockDocumentCopy.findByPk.mockResolvedValue(null);
    const res = await adminService.getDocumentCopy(999);
    expect(res).toBeNull();
    expect(mockDocumentCopy.findByPk).toHaveBeenCalledWith(999, expect.any(Object));
  });

  test('khi tìm thấy -> trả về object chứa copy và document', async () => {
    const fakeCopy = {
      documentCopyId: 1,
      documentId: 10,
      barCode: 'BC-1',
      status: 'Available',
      conditionNote: 'Ok',
      entryDate: new Date(),
      Document: { documentId: 10, title: 'T1', Category: { categoryId: 2, name: 'Sách' } },
      toJSON() { return this; }
    };
    mockDocumentCopy.findByPk.mockResolvedValue(fakeCopy);
    const out = await adminService.getDocumentCopy(1);
    expect(out).toBeDefined();
    expect(out.copy).toBeDefined();
    expect(out.copy.barCode).toBe('BC-1');
  });
});

describe('documentAdminService - addCopies', () => {
  test('thêm single copy và cập nhật numberOfCopy', async () => {
    const documentId = 5;
    const copiesInput = [{ barCode: 'AUTO', status: 'Available', conditionNote: 'Good' }];

    mockDocument.findByPk.mockResolvedValue({ documentId, numberOfCopy: 2, update: jest.fn() });
    mockDocumentCopy.findAll.mockResolvedValue([]);
    mockDocumentCopy.bulkCreate.mockResolvedValue([{ documentCopyId: 100, barCode: 'BCGEN' }]);

    const res = await adminService.addCopies(documentId, copiesInput);
    expect(Array.isArray(res)).toBe(true);
    expect(mockDocument.findByPk).toHaveBeenCalled();
    expect(mockDocumentCopy.bulkCreate).toHaveBeenCalled();
    expect(mockDocument.update).toHaveBeenCalled();
  });

  test('document không tồn tại -> ném lỗi', async () => {
    mockDocument.findByPk.mockResolvedValue(null);
    await expect(adminService.addCopies(999, [{ barCode: 'X' }])).rejects.toThrow();
  });
});

describe('documentAdminService - updateCopy', () => {
  test('cập nhật thành công', async () => {
    const fakeCopy = {
      documentCopyId: 11,
      documentId: 7,
      barCode: 'B11',
      update: jest.fn(),
      toJSON() { return this; }
    };
    mockDocumentCopy.findByPk.mockResolvedValue(fakeCopy);
    mockDocument.findOne = jest.fn().mockResolvedValue({ documentId: 7, toJSON: () => ({ documentId: 7, title: 'T7' }) });

    const result = await adminService.updateCopy(11, { status: 'Lost' });
    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
  });
});
