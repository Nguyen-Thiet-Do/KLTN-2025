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
            path: '/api/auth/login/reader',
            description: 'Đăng nhập vào hệ thống cho độc giả',
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
            description: 'Lấy thông tin cá nhân của độc giả hiện tại (bao gồm cả thông tin tài khoản đi kèm)',
            auth: true,
            role: 'Reader (roleId = 3)',
            response: {
              success: 'boolean',
              reader: {
                // Trường từ Reader
                readerId: 'number',
                accountId: 'number',
                roleId: 'number',
                fullName: 'string',
                dateOfBirth: 'date (YYYY-MM-DD)',
                gender: 'string | null',
                cccd: 'string | null',
                address: 'string | null',
                totolBorrow: 'number',
                note: 'string | null',
                deleted: 'boolean',
                created_at: 'datetime',
                updated_at: 'datetime',

                // Trường tiện dùng (lấy từ Account, đã ẩn mật khẩu và token)
                email: 'string',
                phoneNumber: 'string | null',
                status: 'active | locked | inactive',
                roleId_account: 'number',
                created_at_account: 'datetime',
                updated_at_account: 'datetime',

                // Nhánh đầy đủ của Account (tùy dùng)
                account: 'object | null'
              }
            }
          },
          {
            method: 'PUT',
            path: '/api/profile/me',
            description: 'Cập nhật thông tin cá nhân của độc giả (chỉ cập nhật bảng Readers, không cập nhật tài khoản)',
            auth: true,
            role: 'Reader (roleId = 3)',
            body: {
              fullName: 'string (tùy chọn)',
              gender: 'string (tùy chọn)',
              dateOfBirth: 'date (tùy chọn, dạng YYYY-MM-DD)',
              address: 'string (tùy chọn)',
              cccd: 'string (tùy chọn)',
              note: 'string (tùy chọn)'
              // ❌ Không nhận phoneNumber, email, status... (thuộc Account)
            },
            response: {
              success: 'boolean',
              message: 'string',
              reader: 'object (cấu trúc giống GET /api/profile/me)'
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
          },
          {
            method: 'GET',
            path: '/api/documents/reader/latest',
            description: 'Lấy danh sách tài liệu mới nhất theo loại (book | magazine | newspaper | all). Mặc định lấy tất cả.',
            auth: false,
            query: {
              page: 'number (optional, default=1): trang hiện tại',
              limit: 'number (optional, default=10): số lượng bản ghi trên mỗi trang',
              type: "string (optional, default='all'): 'book' | 'magazine' | 'newspaper' | 'all'"
            },
            examples: [
              "GET /api/documents/reader/latest",
              "GET /api/documents/reader/latest?type=book&page=1&limit=12",
              "GET /api/documents/reader/latest?type=magazine"
            ]
          },
          {
            method: 'GET',
            path: '/api/documents/reader/popular',
            description: 'Lấy danh sách tài liệu được ưa chuộng nhất (xếp theo tổng số lượt mượn của các bản sao) theo loại (book | magazine | newspaper | all). Mặc định lấy tất cả.',
            auth: false,
            query: {
              page: 'number (optional, default=1): trang hiện tại',
              limit: 'number (optional, default=10): số lượng bản ghi trên mỗi trang',
              type: "string (optional, default='all'): 'book' | 'magazine' | 'newspaper' | 'all'"
            },
            examples: [
              "GET /api/documents/reader/popular",
              "GET /api/documents/reader/popular?type=book&limit=5",
              "GET /api/documents/reader/popular?type=newspaper&page=2"
            ]
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
            path: '/api/documents/admin/copies/:copyId',
            description: 'Lấy thông tin bản sao kèm thông tin cọc',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              copyId: 'number (required): ID của bản sao cần lấy thông tin'
            }

          },
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
          },
          {
            method: 'POST',
            path: '/api/documents/admin/books',
            description: 'Tạo mới tài liệu loại Sách (Book) + subtype + copies trong 1 lần',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            body: {
              // Gửi 1 trong 2 kiểu:
              // 1) multipart/form-data: files: cover (required), ebook (optional) + các field text phía dưới
              // 2) application/json: coverUrl (required), ebookViewUrl (optional) + các field
              title: 'string (required)',
              language: 'string (optional)',
              publicationYear: 'number (optional)',
              coverPrice: 'number (optional)',
              description: 'string (optional)',
              shelfLocation: 'string (optional)',
              publisherName: 'string (optional, auto-create if not exists)',
              authors: 'array [{ fullName, role?, ord? }] (optional, auto-create author nếu chưa có)',
              genres: 'array [name] (optional, auto-create genre nếu chưa có)',
              coverUrl: 'string (required nếu không gửi file)',
              ebookViewUrl: 'string (optional)',
              bookData: '{ isbn?: string, edition?: number, pageCount?: number }',
              initialCopies: 'array [{ barCode?, status?, conditionNote?, entryDate? }]',
              initialCopiesCount: 'number (optional, tạo nhanh n bản sao mặc định nếu không đưa initialCopies)'
            },
            examples: [
              'multipart: cover=<file>, ebook=<file>, title=Clean Code, authors=[{"fullName":"Robert C. Martin"}], initialCopiesCount=5',
              'json: { "title":"Clean Code", "coverUrl":"https://.../covers/abc.webp", "bookData":{"isbn":"978-..."},"initialCopies":[{"status":"available","conditionNote":"100"}]}'
            ]
          },
          {
            method: 'POST',
            path: '/api/documents/admin/magazines',
            description: 'Tạo mới tài liệu loại Tạp chí (Magazine) + subtype + copies trong 1 lần',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            body: {
              title: 'string (required)',
              language: 'string (optional)',
              publicationYear: 'number (optional)',
              coverPrice: 'number (optional)',
              description: 'string (optional)',
              shelfLocation: 'string (optional)',
              publisherName: 'string (optional)',
              authors: 'array [{ fullName, role?, ord? }] (optional)',
              genres: 'array [name] (optional)',
              coverUrl: 'string (required nếu không gửi file)',
              ebookViewUrl: 'string (optional)',
              magazineData: '{ issn?: string, volume?: number, issue?: number, period?: string, coverDate?: string }',
              initialCopies: 'array [{ barCode?, status?, conditionNote?, entryDate? }]',
              initialCopiesCount: 'number (optional)'
            }
          },
          {
            method: 'POST',
            path: '/api/documents/admin/newspapers',
            description: 'Tạo mới tài liệu loại Báo (Newspaper) + subtype + copies trong 1 lần',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            body: {
              title: 'string (required)',
              language: 'string (optional)',
              publicationYear: 'number (optional)',
              coverPrice: 'number (optional)',
              description: 'string (optional)',
              shelfLocation: 'string (optional)',
              publisherName: 'string (optional)',
              authors: 'array [{ fullName, role?, ord? }] (optional)',
              genres: 'array [name] (optional)',
              coverUrl: 'string (required nếu không gửi file)',
              ebookViewUrl: 'string (optional)',
              newspaperData: '{ issn?: string, issueDate?: string (YYYY-MM-DD), issueNumber?: number }',
              initialCopies: 'array [{ barCode?, status?, conditionNote?, entryDate? }]',
              initialCopiesCount: 'number (optional)'
            }
          },
          {
            method: 'POST',
            path: '/api/documents/admin/:id/copies',
            description: 'Nhập thêm bản sao (copies) cho tài liệu đã tồn tại',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              id: 'number (required): ID tài liệu'
            },
            // ✨ CHỈNH Ở ĐÂY: body là OBJECT, không phải string
            body: {
              '__type': 'array of copies',
              '[].barCode': 'string (optional)',
              '[].status': 'string (default="available")',
              '[].conditionNote': 'string (ví dụ "100")',
              '[].entryDate': 'string (ISO date, optional)'
            },
            // (không bắt buộc) mẫu để phần Test API điền sẵn
            sampleBody: [
              { "barCode": "BK-0101", "status": "available", "conditionNote": "100" },
              { "status": "available", "conditionNote": "98" }
            ]
          },
          // NEW: Cập nhật Sách (Book)
          {
            method: 'PUT',
            path: '/api/documents/admin/books/:id',
            description: 'Cập nhật tài liệu loại Sách (Book)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              id: 'number (required): ID tài liệu'
            },
            body: {
              // Gửi 1 trong 2 kiểu:
              // 1) multipart/form-data: files: cover (optional), ebook (optional) + các field text phía dưới
              // 2) application/json: coverUrl (optional), ebookViewUrl (optional) + các field
              title: 'string (optional)',
              language: 'string (optional)',
              publicationYear: 'number (optional)',
              coverPrice: 'number (optional)',
              description: 'string (optional)',
              shelfLocation: 'string (optional)',
              publisherName: 'string (optional, ""/null để xoá publisher, không gửi để giữ nguyên)',
              authors: 'array [{ fullName, role?, ord? }] (optional: không gửi=giữ nguyên; []=xoá hết; gửi mảng=thay toàn bộ)',
              genres: 'array [name] (optional: không gửi=giữ nguyên; []=xoá hết; gửi mảng=thay toàn bộ)',
              coverUrl: 'string (optional: không gửi=giữ nguyên; ""/null=xoá)',
              ebookViewUrl: 'string (optional: không gửi=giữ nguyên; ""/null=xoá)',
              bookData: '{ isbn?: string, edition?: number, pageCount?: number } (optional: chỉ cập nhật trường được gửi)'
            },
            examples: [
              'multipart: cover=<file>, title=Clean Code (2nd ed), bookData={"edition":2}',
              'json: { "publisherName": "", "authors": [], "genres": ["Kỹ năng"] }'
            ]
          },

          // NEW: Cập nhật Tạp chí (Magazine)
          {
            method: 'PUT',
            path: '/api/documents/admin/magazines/:id',
            description: 'Cập nhật tài liệu loại Tạp chí (Magazine)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              id: 'number (required): ID tài liệu'
            },
            body: {
              // multipart hoặc json — giống /books/:id
              title: 'string (optional)',
              language: 'string (optional)',
              publicationYear: 'number (optional)',
              coverPrice: 'number (optional)',
              description: 'string (optional)',
              shelfLocation: 'string (optional)',
              publisherName: 'string (optional, ""/null để xoá, không gửi để giữ nguyên)',
              authors: 'array [{ fullName, role?, ord? }] (optional: không gửi=giữ nguyên; []=xoá hết; gửi mảng=thay toàn bộ)',
              genres: 'array [name] (optional: không gửi=giữ nguyên; []=xoá hết; gửi mảng=thay toàn bộ)',
              coverUrl: 'string (optional: không gửi=giữ nguyên; ""/null=xoá)',
              ebookViewUrl: 'string (optional: không gửi=giữ nguyên; ""/null=xoá)',
              magazineData: '{ issn?: string, volume?: number, issue?: number, period?: string, coverDate?: string } (optional)'
            },
            examples: [
              'multipart: ebook=<file>, magazineData={"issue":10,"volume":42}',
              'json: { "coverUrl": null, "magazineData": { "period": "Monthly" } }'
            ]
          },

          // NEW: Cập nhật Báo (Newspaper)
          {
            method: 'PUT',
            path: '/api/documents/admin/newspapers/:id',
            description: 'Cập nhật tài liệu loại Báo (Newspaper)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              id: 'number (required): ID tài liệu'
            },
            body: {
              // multipart hoặc json — giống /books/:id
              title: 'string (optional)',
              language: 'string (optional)',
              publicationYear: 'number (optional)',
              coverPrice: 'number (optional)',
              description: 'string (optional)',
              shelfLocation: 'string (optional)',
              publisherName: 'string (optional, ""/null để xoá, không gửi để giữ nguyên)',
              authors: 'array [{ fullName, role?, ord? }] (optional: không gửi=giữ nguyên; []=xoá hết; gửi mảng=thay toàn bộ)',
              genres: 'array [name] (optional: không gửi=giữ nguyên; []=xoá hết; gửi mảng=thay toàn bộ)',
              coverUrl: 'string (optional: không gửi=giữ nguyên; ""/null=xoá)',
              ebookViewUrl: 'string (optional: không gửi=giữ nguyên; ""/null=xoá)',
              newspaperData: '{ issn?: string, issueDate?: string (YYYY-MM-DD), issueNumber?: number } (optional)'
            },
            examples: [
              'multipart: cover=<file>, newspaperData={"issueDate":"2025-03-01"}',
              'json: { "genres": [], "newspaperData": { "issueNumber": 120 } }'
            ]
          },
          {
            method: 'DELETE',
            path: '/api/documents/admin/:id',
            description: 'Xoá mềm tài liệu theo ID (soft delete)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              id: 'number (required): ID tài liệu cần xoá'
            },
            query: {
              cascadeSubtype: '0|1 (optional, default=1) — xoá mềm Book/Magazine/Newspaper',
              cascadeCopies: '0|1 (optional, default=0) — xoá mềm toàn bộ bản sao (cấm nếu có copy ở trạng thái bị chặn)',
              cascadeMaps: '0|1 (optional, default=0) — xoá mềm liên kết tác giả/thể loại'
            }
          },
          {
            method: 'DELETE',
            path: '/api/documents/admin/copies/:copyId',
            description: 'Xoá mềm bản sao theo ID (soft delete)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              copyId: 'number (required): ID bản sao cần xoá'
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
        group: 'Loan Slips Admin',
        icon: '📄',
        routes: [
          {
            method: 'GET',
            path: '/api/loans/admin/loans',
            description: 'Xem tất cả phiếu mượn (dành cho Admin/Thủ thư)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=10)',
              status: 'string (optional, lọc theo trạng thái)',
              fromDate: 'date (optional, lọc từ ngày)',
              toDate: 'date (optional, lọc đến ngày)',
              sortBy: 'string (optional, default="loanDate")',
              sortDir: 'string (optional, "ASC" | "DESC", default="DESC")'
            }
          },
          {
            method: 'POST',
            path: '/api/loans/admin/loans',
            description: 'Tạo phiếu mượn ở trạng thái chờ thanh toán (PENDING_PAYMENT)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            body: {
              readerId: 'number (required)',
              librarianId: 'number (required)',
              loanDate: "date (optional, 'YYYY-MM-DD')",
              dueDate: "date (optional, 'YYYY-MM-DD')",
              items: 'array (required) — [{ documentCopyId:number, depositAmount?:number, note?:string }]',
              totalAmount: 'number (optional) — nếu không gửi sẽ = tổng depositAmount',
            },
            examples: [
              '{ "readerId": 10, "librarianId": 2, "items":[{"documentCopyId":101,"depositAmount":50000}], "totalAmount":50000 }'
            ]
          },
          {
            method: 'POST',
            path: '/api/loans/admin/loans/:loanSlipId/payment/qr',
            description: 'Tạo QR thanh toán cho 1 phiếu mượn đang PENDING_PAYMENT',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)',
            },
            body: {
              amount: 'number (required)',
              description: 'string (optional)'
            },
            response: {
              success: 'boolean',
              paymentId: 'number (id của payment vừa tạo)',
              amount: 'number',
              status: 'string (PENDING)',
              transactionCode: 'string',
              qr: '{ type: "data-url", content: "data:image/png;base64,..." }'
            }
          },

          // ================== MỚI: XÁC NHẬN THANH TOÁN ==================
          {
            method: 'PATCH',
            path: '/api/loans/admin/loans/:loanSlipId/payment/confirm',
            description: 'Xác nhận thanh toán theo loanSlipId (coi như đã thanh toán)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)'
            },
            body: {
              transactionCode: 'string (optional) — mã đối soát (nếu có)'
            },
            response: {
              success: 'boolean',
              message: 'string',
              loanSlipId: 'number',
              // Hiệu ứng: LoanSlip: PENDING_PAYMENT -> OPEN; LoanDetail: PENDING_PAYMENT -> BORROWED; DocumentCopy: ON_HOLD -> BORROWED
            }
          },
          {
            method: 'PATCH',
            path: '/api/loans/admin/payments/:paymentId/confirm',
            description: 'Xác nhận thanh toán theo paymentId (đối soát qua bảng Payment)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              paymentId: 'number (required)'
            },
            body: {
              transactionCode: 'string (optional)'
            },
            response: {
              success: 'boolean',
              message: 'string',
              loanSlipId: 'number'
            }
          },

          // ================== MỚI: DUYỆT PHIẾU ĐẶT TRƯỚC ==================
          {
            method: 'POST',
            path: '/api/loans/admin/reservations/:loanSlipId/approve',
            description: 'Duyệt phiếu đặt trước (PENDING, borrowForm=RESERVATION) -> WAITING_FOR_PICKUP; gán bản sao & chốt cọc',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)'
            },
            body: {
              librarianId: 'number (required) — người duyệt',
              dueDate: "date (optional, 'YYYY-MM-DD')",
              pricingMode: "string (optional, 'AUTO_MIN' | 'AUTO_MAX' | 'MANUAL', default='AUTO_MIN')",
              deposits: 'array (optional; chỉ cần khi MANUAL hoặc ghi đè) — [{ loanDetailId:number, depositAmount:number }]',
              assignments: 'array (optional; chỉ định bản sao) — [{ loanDetailId:number, documentCopyId:number }]',
              createPayment: 'boolean (optional, default=false) — nếu true sẽ tạo Payment PENDING = tổng cọc'
            },
            response: {
              success: 'boolean',
              message: 'string',
              loanSlipId: 'number',
              slipStatus: 'string (WAITING_FOR_PICKUP)',
              totalDeposit: 'number',
              payment: '{ paymentId:number, amount:number, status:\'PENDING\', transactionCode:string } | null'
            }
          }
        ]
      },

      {
        group: 'Loan Slips Reader',
        icon: '📄',
        routes: [
          {
            method: 'GET',
            path: '/api/loans/reader/loans/my',
            description: 'Xem lịch sử mượn trả của chính mình (dành cho Độc giả)',
            auth: true,
            role: 'Reader (roleId = 3)',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=10)',
              status: 'string (optional, lọc theo trạng thái)',
              fromDate: 'date (optional, lọc từ ngày)',
              toDate: 'date (optional, lọc đến ngày)',
              sortBy: 'string (optional, default="loanDate")',
              sortDir: 'string (optional, "ASC" | "DESC", default="DESC")'
            }
          },
          {
            method: 'POST',
            path: '/api/loans/reader/loans/reserve',
            description: 'Độc giả đăng ký đặt mượn trước (PENDING, chưa chọn bản sao)',
            auth: true,
            role: 'Reader (roleId = 3)',
            body: {
              items: 'array [{ documentId:number, quantity?:number>=1 }] (required)',
              note: 'string (optional)'
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