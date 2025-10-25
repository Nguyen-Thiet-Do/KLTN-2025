const express = require('express')
const routeApi = express.Router()
const testController = require('../controller/test');



// Root route - API Documentation với EJS
routeApi.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const apiDocs = {
    title: 'Library Management System API',
    version: '1.0.0',
    description: 'API Documentation cho hệ thống quản lý thư viện',
    developer: 'Độ Hiệp Hiếu',
    baseUrl: baseUrl,
    serverTime: new Date().toLocaleString('vi-VN'),
    endpoints: [
      {
        group: 'Authentication',
        icon: '🔐',
        routes: [
          {
            method: 'GET',
            path: '/api/auth',
            description: 'Kiểm tra trạng thái auth route',
            auth: false
          },
          {
            method: 'POST',
            path: '/api/auth/register',
            description: 'Đăng ký tài khoản độc giả mới',
            auth: false,
            body: {
              email: 'string (required)',
              password: 'string (required, min 6 chars)',
              fullName: 'string (required)',
              phoneNumber: 'string (optional, 10-11 digits)',
              dateOfBirth: 'date (optional)',
              gender: 'number (optional, 0=Female, 1=Male)',
              cccd: 'string (optional, 9-12 digits)',
              address: 'string (optional)',
              note: 'string (optional)'
            }
          },
          {
            method: 'POST',
            path: '/api/auth/login',
            description: 'Đăng nhập vào hệ thống',
            auth: false,
            body: {
              email: 'string (required)',
              password: 'string (required)'
            }
          },
          {
            method: 'POST',
            path: '/api/auth/refresh-token',
            description: 'Làm mới access token',
            auth: false,
            body: {
              refreshToken: 'string (required)'
            }
          },
          {
            method: 'POST',
            path: '/api/auth/logout',
            description: 'Đăng xuất khỏi hệ thống',
            auth: true
          },
          {
            method: 'GET',
            path: '/api/auth/profile',
            description: 'Lấy thông tin profile người dùng',
            auth: true
          },
          {
            method: 'GET',
            path: '/api/auth/admin',
            description: 'Route dành cho admin (ví dụ)',
            auth: true,
            role: 'Admin (roleId = 1)'
          }
        ]
      },
      {
        group: 'Profile',
        icon: '👤',
        routes: [
          {
            method: 'GET',
            path: '/api/profile/me',
            description: 'Lấy thông tin cá nhân của độc giả hiện tại',
            auth: true,
            role: 'Reader (roleId = 3)'
          },
          {
            method: 'PUT',
            path: '/api/profile/me',
            description: 'Cập nhật thông tin cá nhân của độc giả hiện tại',
            auth: true,
            role: 'Reader (roleId = 3)',
            body: {
              fullName: 'string (optional)',
              phoneNumber: 'string (optional, 10-11 digits)',
              dateOfBirth: 'date (optional)',
              address: 'string (optional)',
            }
          }
        ]
      },
      {
        group: 'Documents of Reader',
        icon: '📚',
        routes: [
          {
            method: 'GET',
            path: '/api/documents/reader',
            description: 'Lấy tài liệu theo loại (Book, Newspaper, Magazine, all) kèm cọc min/max, số bản sao sẵn sàng',
            auth: false,
            query: {
              page: 'number (optional, default=1): trang hiện tại',
              limit: 'number (optional, default=10):  số lượng bản ghi trên mỗi trang',
              search: 'string (optional, tìm kiếm theo tiêu đề): tên tài liệu cần tìm',
              type: "string (optional, 'book' | 'magazine' | 'newspaper' | 'all', default='all'): loại tài liệu"
            }
          },
          {
            method: 'GET',
            path: '/api/documents/reader/:id',
            description: 'Lấy chi tiết 1 tài liệu kèm cọc min/max, số bản sao sẵn sàng',
            auth: false,
            params: {
              id: 'number (required): ID của tài liệu cần lấy chi tiết'
            }
          },
          {
            method: 'GET',
            path: '/api/documents/ebook/:id',
            description: 'Lấy URL ebook của tài liệu',
            auth: true,
            role: 'Reader (roleId = 3)',
            params: {
              id: 'number (required): ID của tài liệu cần lấy URL ebook'
            }
          },
          {
            method: 'GET',
            path: '/api/documents/genres',
            description: 'Lấy danh sách thể loại tài liệu',
            auth: false

          },
          {
            method: 'GET',
            path: '/api/documents/reader/by-genre',
            description: "Lọc tài liệu theo thể loại (genre) — hỗ trợ match 'any' | 'all'",
            auth: false,
            query: {
              page: 'number (optional, default=1): trang hiện tại',
              limit: 'number (optional, default=10):  số lượng bản ghi trên mỗi trang',
              search: 'string (optional, tìm kiếm theo tiêu đề): tên tài liệu cần tìm',
              type: "string (optional, 'book' | 'magazine' | 'newspaper' | 'all', default='all'): loại tài liệu",
              genreIds: 'string (required, ví dụ: "2,5,9"): Danh sách genreId, cách nhau bởi dấu phẩy',
              match: "string (optional, 'any' | 'all', default='any'): 'any' (ít nhất 1) | 'all' (đầy đủ)"
            }
          },
          {
            method: 'GET',
            path: '/api/documents/reader/search',
            description: 'Tìm kiếm tài liệu toàn diện (tiêu đề, tác giả, mô tả, thể loại v.v.)',
            auth: false,
            query: {
              page: 'number (optional, default=1): trang hiện tại',
              limit: 'number (optional, default=10):  số lượng bản ghi trên mỗi trang',
              q: 'string (required): từ khóa tìm kiếm'
            }
          },
          {
            method: 'GET',
            path: '/api/documents/reader/:id/similar',
            description: 'Gợi ý tài liệu tương tự theo id tài liệu đang xem',
            auth: false,
            params: {
              id: 'number (required): ID của tài liệu hiện tại'
            },
            query: {
              limit: 'number (optional, default=10): số lượng gợi ý',
              // wGenre: 'number (optional, default=2): trọng số genre',
              // wAuthor: 'number (optional, default=3): trọng số author',
              // wPublisher: 'number (optional, default=1): trọng số publisher',
              // wCategory: 'number (optional, default=1): trọng số category'
            }
          }

        ]
      },
      {
        group: 'Metadata',
        icon: '🗂️',
        routes: [
          {
            method: 'GET',
            path: '/api/metadata/authors',
            description: 'Lấy danh sách tất cả tác giả',
            auth: false
          },
          {
            method: 'GET',
            path: '/api/metadata/categories',
            description: 'Lấy danh sách tất cả thể loại',
            auth: false
          },
          {
            method: 'GET',
            path: '/api/metadata/publishers',
            description: 'Lấy danh sách tất cả nhà xuất bản',
            auth: false
          },
          {
            method: 'GET',
            path: '/api/metadata/genres',
            description: 'Lấy danh sách tất cả thể loại (genre)',
            auth: false
          },
          {
            method: 'POST',
            path: '/api/metadata/author',
            description: 'Thêm tác giả mới',
            auth: true,
            role: 'Admin (roleId = 1), librarian (roleId = 2)',
            body: {
              name: 'string (required)',
              note: 'string (optional)',
            }
          },
          {
            method: 'POST',
            path: '/api/metadata/genre',
            description: 'Thêm thể loại mới',
            auth: true,
            role: 'Admin (roleId = 1), librarian (roleId = 2)',
            body: {
              name: 'string (required)',
              note: 'string (optional)',
            }
          },
          {
            method: 'POST',
            path: '/api/metadata/publisher',
            description: 'Thêm nhà xuất bản mới',
            auth: true,
            role: 'Admin (roleId = 1), librarian (roleId = 2)',
            body: {
              name: 'string (required)',
              note: 'string (optional)',
            }
          }

        ]
      },
      {
        group: 'document Admin',
        icon: '📚',
        routes: [
          {
            method: 'GET',
            path: '/api/documents/admin/books/basic',
            description: 'Lấy danh sách tài liệu cơ bản loại Sách (Book)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=20, max=100)',
              search: 'string (optional, tìm theo tiêu đề)'
            }
          },
          {
            method: 'GET',
            path: '/api/documents/admin/magazines/basic',
            description: 'Lấy danh sách tài liệu cơ bản loại Tạp chí (Magazine)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=20, max=100)',
              search: 'string (optional, tìm theo tiêu đề)'
            }
          },
          {
            method: 'GET',
            path: '/api/documents/admin/newspapers/basic',
            description: 'Lấy danh sách tài liệu cơ bản loại Báo (Newspaper)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=20, max=100)',
              search: 'string (optional, tìm theo tiêu đề)'
            }
          },
          {
            method: 'GET',
            path: '/api/documents/admin/basic',
            description: 'Lấy danh sách tài liệu cơ bản theo loại (Book, Magazine, Newspaper, All)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            query: {
              documentType: "string (optional, 'book' | 'magazine' | 'newspaper' | 'all', default='all')",
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=20, max=100)',
              search: 'string (optional, tìm theo tiêu đề)'
            }
          },
          {
            method: 'GET',
            path: '/api/documents/admin/:id/copies',
            description: 'Lấy danh sách bản sao của tài liệu kèm thông tin cọc min/max',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              id: 'number (required): ID của tài liệu cần lấy bản sao'
            }
          }
        ]
      },
      {
        group: 'Librarians',
        icon: '📚',
        routes: [
          {
            method: 'GET',
            path: '/api/librarian',
            description: 'Lấy danh sách tất cả thủ thư',
            auth: true,
            role: 'Admin (roleId = 1)',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=10)',
              search: 'string (optional, tìm theo tên, email)'
            }
          },
          {
            method: 'GET',
            path: '/api/librarian/me',
            description: 'Lấy thông tin thủ thư hiện tại',
            auth: true,
            role: 'Librarian (roleId = 2)'
          },
          {
            method: 'POST',
            path: '/api/librarian',
            description: 'Thêm thủ thư mới',
            auth: true,
            role: 'Admin (roleId = 1)',
            body: {
              accountId: 'number (required)',
              fullName: 'string (required)',
              dateOfBirth: 'date (optional)',
              gender: 'number (optional, 0=Nữ, 1=Nam)',
              cccd: 'string (optional)',
              address: 'string (optional)',
              hireDate: 'date (optional)',
              basicSalary: 'number (optional)',
              salaryCoefficient: 'number (optional)'
            }
          },
          {
            method: 'PUT',
            path: '/api/librarian/:id',
            description: 'Cập nhật thông tin thủ thư',
            auth: true,
            role: 'Admin (roleId = 1)',
            params: {
              id: 'number (required)'
            },
            body: {
              fullName: 'string (optional)',
              dateOfBirth: 'date (optional)',
              gender: 'number (optional, 0=Nữ, 1=Nam)',
              cccd: 'string (optional)',
              address: 'string (optional)',
              hireDate: 'date (optional)',
              basicSalary: 'number (optional)',
              salaryCoefficient: 'number (optional)'
            }
          },
          {
            method: 'DELETE',
            path: '/api/librarian/:id',
            description: 'Xóa thủ thư theo ID',
            auth: true,
            role: 'Admin (roleId = 1)',
            params: {
              id: 'number (required)'
            }
          }
        ]
      },
      {
        group: 'Test',
        icon: '🧪',
        routes: [
          {
            method: 'GET',
            path: '/tests',
            description: 'Lấy danh sách test',
            auth: false
          }
        ]
      },
      {
        group: 'System',
        icon: '⚙️',
        routes: [
          {
            method: 'GET',
            path: '/health',
            description: 'Kiểm tra trạng thái server',
            auth: false
          }
        ]
      }
    ]
  };

  res.render('api-docs', apiDocs);
});

routeApi.get('/tests', testController.getAll);

module.exports = routeApi;