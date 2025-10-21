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
        group: 'Documents of Reader',
        icon: '📚',
        routes: [
          {
            method: 'GET',
            path: '/api/documents/reader',
            description: 'Lấy tài liệu theo loại (Book, Newspaper, Magazine, all) kèm cọc min/max, số bản sao sẵn sàng',
            auth: true,
            role: 'Reader (roleId = 3)',
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
            auth: true,
            role: 'Reader (roleId = 3)',
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
          }
      
        ]
      },
      {
        group: 'Users ( đang phát triển )',
        icon: '👥',
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            description: 'Lấy danh sách người dùng (Admin only)',
            auth: true,
            role: 'Admin (roleId = 1)',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=10)',
              search: 'string (optional, tìm kiếm theo tên hoặc email)'
            }
          },
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