/**
 * metadataService.test.js
 */

jest.resetModules();

const mockMeta = {
  create: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn()
};

jest.doMock('../model', () => ({ Metadata: mockMeta }));

// Safe import
const _meta = require('../service/metadataService');
const metaService = _meta && (_meta.default || _meta);

beforeEach(() => {
  jest.clearAllMocks();
  mockMeta.findOne.mockResolvedValue(null);
  mockMeta.create.mockResolvedValue(null);
});

describe('metadataService', () => {
  test('addMetadata - khi thiếu key -> ném lỗi', async () => {
    // gọi hàm bằng cách lấy service export an toàn
    await expect(metaService.addMetadata({ key: null })).rejects.toThrow();
  });

  test('addMetadata - tạo metadata thành công', async () => {
    mockMeta.create.mockResolvedValue({ metadataId: 1, key: 'k', value: 'v' });
    const res = await metaService.addMetadata({ key: 'k', value: 'v' });
    expect(res.metadataId).toBe(1);
  });

  test('updateMetadata - nếu không tìm thấy -> trả về failure', async () => {
    mockMeta.findOne.mockResolvedValue(null);
    const r = await metaService.updateMetadata('not-exist', { value: 'x' });
    expect(r.success).toBe(false);
  });

  test('getMetadata - trả về null nếu không tìm thấy', async () => {
    mockMeta.findOne.mockResolvedValue(null);
    const r = await metaService.getMetadata('no');
    expect(r).toBeNull();
  });

  test('getMetadata - trả về metadata khi tìm thấy', async () => {
    mockMeta.findOne.mockResolvedValue({ key: 'a', value: 'b' });
    const r = await metaService.getMetadata('a');
    expect(r.key).toBe('a');
  });
});
