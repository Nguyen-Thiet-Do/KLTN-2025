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
            path: '/api/auth/register/init',
            description: 'Bước 1: Khởi tạo đăng ký - Gửi mã OTP đến email',
            detailedDescription: 'Endpoint này bắt đầu quy trình đăng ký bằng cách gửi mã OTP 6 số đến email của người dùng. Hệ thống sẽ kiểm tra email có tồn tại trong database chưa và từ chối nếu email đã được đăng ký. OTP có hiệu lực trong 10 phút.',
            auth: false,
            body: {
              email: 'string (required, valid email format) - Email người dùng muốn đăng ký'
            },
            response: {
              success: {
                ok: true,
                message: 'OTP_SENT - OTP đã được gửi đến email'
              },
              error: {
                'EMAIL_EXISTS': 'Email đã được sử dụng để đăng ký tài khoản khác',
                'MISSING_EMAIL': 'Thiếu thông tin email',
                'INVALID_EMAIL': 'Định dạng email không hợp lệ'
              }
            },
            example: {
              request: {
                email: 'user@example.com'
              },
              response: {
                ok: true,
                message: 'OTP_SENT'
              }
            }
          },
          {
            method: 'POST',
            path: '/api/auth/register/verify',
            description: 'Bước 2: Xác thực OTP và tạo tài khoản độc giả',
            detailedDescription: 'Endpoint này xác thực mã OTP nhận được từ email và tạo tài khoản độc giả mới trong hệ thống. Sau khi xác thực thành công, hệ thống sẽ tạo Account (với roleId=3) và Reader record tương ứng. Trả về accountId và readerId để sử dụng cho bước tiếp theo.',
            auth: false,
            body: {
              email: 'string (required) - Email đã dùng ở bước 1',
              otp: 'string (required, 6 digits) - Mã OTP nhận được từ email',
              password: 'string (required, min 6 chars) - Mật khẩu cho tài khoản',
              fullName: 'string (required) - Họ và tên đầy đủ',
              phoneNumber: 'string (optional, 10-11 digits) - Số điện thoại',
              dateOfBirth: 'date (optional, format: YYYY-MM-DD) - Ngày sinh',
              gender: 'string (optional, "male" or "female") - Giới tính',
              cccd: 'string (optional, 9-12 digits) - Số CMND/CCCD',
              address: 'string (optional) - Địa chỉ'
            },
            response: {
              success: {
                ok: true,
                data: {
                  account: {
                    accountId: 'number - ID tài khoản vừa tạo',
                    email: 'string - Email đã đăng ký'
                  },
                  reader: {
                    readerId: 'number - ID độc giả (dùng cho bước 3)',
                    fullName: 'string - Họ tên độc giả'
                  }
                }
              },
              error: {
                'OTP_INVALID_OR_EXPIRED': 'Mã OTP không đúng hoặc đã hết hạn (10 phút)',
                'EMAIL_EXISTS': 'Email đã được đăng ký bởi người khác',
                'CCCD_EXISTS': 'Số CMND/CCCD đã được đăng ký',
                'MISSING_FIELDS': 'Thiếu các trường bắt buộc (email, otp, password, fullName)',
                'WEAK_PASSWORD': 'Mật khẩu phải có ít nhất 6 ký tự'
              }
            },
            example: {
              request: {
                email: 'user@example.com',
                otp: '123456',
                password: 'mypassword123',
                fullName: 'Nguyễn Văn A',
                phoneNumber: '0123456789',
                dateOfBirth: '2000-01-15',
                gender: 'male',
                cccd: '001234567890',
                address: 'Hà Nội'
              },
              response: {
                ok: true,
                data: {
                  account: {
                    accountId: 120260,
                    email: 'user@example.com'
                  },
                  reader: {
                    readerId: 120351,
                    fullName: 'Nguyễn Văn A'
                  }
                }
              }
            }
          },
          {
            method: 'POST',
            path: '/api/auth/register/complete',
            description: 'Bước 3: Chọn loại thẻ thành viên và hoàn tất đăng ký',
            detailedDescription: 'Endpoint cuối cùng trong quy trình đăng ký, cho phép người dùng chọn loại thẻ thành viên (FREE hoặc PREMIUM). Nếu chọn SKIP hoặc thẻ miễn phí, hệ thống sẽ tạo MemberCard ngay lập tức. Nếu chọn PAY với thẻ trả phí (PREMIUM - 150,000đ), hệ thống sẽ tạo payment record và trả về QR code PayOS để thanh toán. Sau khi thanh toán thành công, webhook sẽ tự động tạo MemberCard với balance = số tiền đã trả.',
            auth: false,
            body: {
              readerId: 'number (required) - ID độc giả từ bước 2',
              cardTypeId: 'number (required) - Loại thẻ: 1=FREE (miễn phí), 2=PREMIUM (150,000đ)',
              action: 'string (required) - Hành động: "SKIP" (bỏ qua/miễn phí) hoặc "PAY" (thanh toán)',
              extraInfo: 'object (optional) - Thông tin bổ sung (nếu cần)'
            },
            response: {
              skip_or_free: {
                ok: true,
                free: true,
                memberCard: {
                  memberCardId: 'number - ID thẻ thành viên',
                  cardNumber: 'string - Mã số thẻ (dạng C + timestamp)',
                  cardTypeId: 'number - Loại thẻ đã chọn',
                  balance: 'number - Số dư trong thẻ (0 nếu FREE, hoặc = giá thẻ)',
                  status: 'string - Trạng thái thẻ (ACTIVE)',
                  issueDate: 'date - Ngày cấp thẻ',
                  expiryDate: 'date - Ngày hết hạn (issueDate + duration)'
                }
              },
              pay: {
                ok: true,
                paymentId: 'number - ID bản ghi thanh toán',
                orderCode: 'number - Mã đơn hàng PayOS (timestamp)',
                amount: 'number - Số tiền cần thanh toán',
                payos: {
                  checkoutUrl: 'string - URL trang thanh toán PayOS',
                  qrCode: 'string - Mã QR code để quét thanh toán',
                  paymentLinkId: 'string - ID link thanh toán PayOS'
                }
              },
              error: {
                'CARD_TYPE_NOT_FOUND': 'Loại thẻ không tồn tại hoặc đã bị xóa',
                'MISSING_FIELDS': 'Thiếu readerId hoặc cardTypeId',
                'PAYOS_CREATE_FAILED': 'Không thể tạo link thanh toán PayOS'
              }
            },
            example: {
              request_skip: {
                readerId: 120351,
                cardTypeId: 1,
                action: 'SKIP'
              },
              response_skip: {
                ok: true,
                free: true,
                memberCard: {
                  memberCardId: 68,
                  cardNumber: 'C1731654231835',
                  cardTypeId: 1,
                  balance: 0,
                  status: 'ACTIVE',
                  issueDate: '2025-11-15',
                  expiryDate: '2026-11-15'
                }
              },
              request_pay: {
                readerId: 120351,
                cardTypeId: 2,
                action: 'PAY'
              },
              response_pay: {
                ok: true,
                paymentId: 319,
                orderCode: 1763173347531,
                amount: 150000,
                payos: {
                  checkoutUrl: 'https://pay.payos.vn/web/2c43f9579705408dbf2a0723950211aa',
                  qrCode: '00020101021238570010A000000727012700069704220113VQRQAFHJG27860208QRIBFTTA530370454061500005802VN62190815Mua the PREMIUM6304CB92',
                  paymentLinkId: '2c43f9579705408dbf2a0723950211aa'
                }
              }
            },
            note: '⚠️ Quan trọng: Với action="PAY", sau khi user thanh toán thành công qua QR code, PayOS sẽ gửi webhook đến /api/payos/webhook. Webhook sẽ tự động tạo MemberCard với balance = 150,000đ. User cần đăng nhập lại hoặc gọi /api/auth/profile để xem thẻ vừa được tạo.'
          },
          {
            method: 'POST',
            path: '/api/auth/login',
            description: 'Đăng nhập vào hệ thống (dành cho Admin và Thủ thư)',
            detailedDescription: 'Endpoint đăng nhập cho Admin (roleId=1) và Librarian/Thủ thư (roleId=2). Sử dụng email và password để xác thực. Trả về access token (hết hạn sau 1 giờ), refresh token (hết hạn sau 7 ngày) và thông tin profile đầy đủ của người dùng.',
            auth: false,
            body: {
              email: 'string (required) - Email tài khoản',
              password: 'string (required) - Mật khẩu'
            },
            response: {
              success: {
                account: 'object - Thông tin tài khoản',
                profile: 'object - Thông tin admin/librarian',
                profileType: 'string - Loại profile (admin/librarian)',
                accessToken: 'string - JWT access token',
                refreshToken: 'string - JWT refresh token'
              },
              error: {
                'INVALID_CREDENTIALS': 'Email hoặc mật khẩu không đúng',
                'ACCOUNT_DELETED': 'Tài khoản đã bị vô hiệu hóa',
                'INACTIVE_ACCOUNT': 'Tài khoản chưa được kích hoạt'
              }
            }
          },
          {
            method: 'POST',
            path: '/api/auth/login/reader',
            description: 'Đăng nhập vào hệ thống cho độc giả (roleId = 3)',
            detailedDescription: 'Endpoint đăng nhập dành riêng cho độc giả (Reader). Chỉ cho phép tài khoản với roleId=3 đăng nhập. Trả về access token, refresh token và thông tin profile bao gồm cả thẻ thành viên (MemberCard) nếu có, cùng thống kê số phiếu mượn.',
            auth: false,
            body: {
              email: 'string (required) - Email tài khoản độc giả',
              password: 'string (required) - Mật khẩu'
            },
            response: {
              success: {
                account: 'object - Thông tin tài khoản',
                profile: 'object - Thông tin độc giả (bao gồm memberCard, loanCounts)',
                profileType: 'string - "reader"',
                accessToken: 'string - JWT access token (1h)',
                refreshToken: 'string - JWT refresh token (7 days)'
              },
              error: {
                'INVALID_CREDENTIALS': 'Email hoặc mật khẩu không đúng',
                'ACCOUNT_DELETED': 'Tài khoản đã bị vô hiệu hóa',
                'FORBIDDEN': 'Chỉ tài khoản độc giả được phép đăng nhập tại endpoint này'
              }
            }
          },
          {
            method: 'POST',
            path: '/api/fcm/register',
            description: 'Đăng ký / cập nhật FCM token cho tài khoản hiện tại',
            detailedDescription: 'Gọi khi user đăng nhập hoặc khi Firebase trả về token mới (onNewToken). Endpoint lưu token vào trường Account.fcmToken, cập nhật lastLoginAt cho account hiện tại để đánh dấu là chủ sở hữu mới nhất của token. Nếu token trùng với token đã lưu ở account khác, server sẽ xóa token đó khỏi các account khác để tránh gửi nhầm thông báo.',
            auth: true,
            body: {
              fcmToken: 'string (required) - Firebase Cloud Messaging token của thiết bị'
            },
            response: {
              success: {
                success: true,
                message: 'Token saved'
              },
              error: {
                'MISSING_FCM_TOKEN': 'Thiếu fcmToken trong body',
                'ACCOUNT_NOT_FOUND': 'Không tìm thấy account (user không hợp lệ)',
                'SERVER_ERROR': 'Lỗi server khi lưu token'
              }
            },
            example: {
              request: {
                fcmToken: 'fAhK2Nz8XyZ123ABC...'
              },
              response: {
                success: true,
                message: 'Token saved'
              }
            }
          },
          {
            method: 'POST',
            path: '/api/auth/refresh-token',
            description: 'Làm mới access token khi hết hạn',
            detailedDescription: 'Endpoint này cho phép làm mới access token mà không cần đăng nhập lại. Gửi refresh token còn hiệu lực (7 ngày) để nhận access token và refresh token mới. Hệ thống sẽ vô hiệu hóa refresh token cũ và lưu refresh token mới vào database.',
            auth: false,
            body: {
              refreshToken: 'string (required) - Refresh token nhận được khi đăng nhập'
            },
            response: {
              success: {
                accessToken: 'string - Access token mới (1h)',
                refreshToken: 'string - Refresh token mới (7 days)'
              },
              error: {
                'INVALID_REFRESH_TOKEN': 'Refresh token không hợp lệ hoặc đã hết hạn',
                'INACTIVE_ACCOUNT': 'Tài khoản không hoạt động'
              }
            }
          },
          {
            method: 'POST',
            path: '/api/auth/logout',
            description: 'Đăng xuất khỏi hệ thống',
            detailedDescription: 'Endpoint đăng xuất sẽ xóa refresh token khỏi database, vô hiệu hóa tất cả refresh token của người dùng. Client cần tự xóa access token và refresh token đã lưu ở local storage.',
            auth: true,
            response: {
              success: {
                message: 'Đăng xuất thành công'
              }
            }
          },
          {
            method: 'GET',
            path: '/api/auth/profile',
            description: 'Lấy thông tin profile đầy đủ của người dùng hiện tại',
            detailedDescription: 'Endpoint này trả về thông tin chi tiết của người dùng dựa trên access token. Đối với độc giả (roleId=3), response bao gồm thông tin thẻ thành viên (memberCard) và thống kê phiếu mượn (loanCounts: pending, waitingPickup, borrowing, returned). Đối với admin/librarian, trả về thông tin librarian profile.',
            auth: true,
            response: {
              reader: {
                account: 'object - Thông tin tài khoản (accountId, email, phoneNumber, status, roleId)',
                profile: {
                  readerId: 'number',
                  fullName: 'string',
                  dateOfBirth: 'date',
                  gender: 'string',
                  cccd: 'string',
                  address: 'string',
                  totalBorrow: 'number',
                  memberCard: {
                    memberCardId: 'number',
                    cardNumber: 'string',
                    cardTypeId: 'number',
                    balance: 'number - Số dư trong thẻ',
                    status: 'string - ACTIVE/EXPIRED/CANCELLED',
                    issueDate: 'date',
                    expiryDate: 'date',
                    cardType: 'object - Thông tin loại thẻ'
                  },
                  loanCounts: {
                    pending: 'number - Số phiếu đang chờ duyệt',
                    waitingPickup: 'number - Số phiếu chờ lấy sách',
                    borrowing: 'number - Số phiếu đang mượn',
                    activeTotal: 'number - Tổng số phiếu đang hoạt động'
                  },
                  returnedCount: 'number - Số phiếu đã trả'
                },
                profileType: 'string - "reader"'
              },
              admin_librarian: {
                account: 'object - Thông tin tài khoản',
                profile: 'object - Thông tin librarian',
                profileType: 'string - "admin" hoặc "librarian"'
              }
            }
          },
          {
            method: 'GET',
            path: '/api/auth/admin',
            description: 'Route dành riêng cho Admin (ví dụ)',
            detailedDescription: 'Endpoint mẫu để kiểm tra phân quyền. Chỉ tài khoản với roleId=1 (Admin) mới có thể truy cập. Được bảo vệ bởi middleware checkRole.',
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
            method: 'PUT',
            path: '/api/documents/admin/copies/:copyId',
            description: 'Cập nhật thông tin bản sao theo ID',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              copyId: 'number (required): ID bản sao cần cập nhật'
            },
            body: {
              barCode: 'string (optional)',
              status: 'string (optional)',
              conditionNote: 'string (optional)',
              entryDate: 'date (optional, dạng YYYY-MM-DD)'
            }
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
            description: 'Tạo phiếu mượn ở trạng thái chờ đến lấy (WAITING_FOR_PICKUP)',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            body: {
              readerId: 'number (required)',
              librarianId: 'number (required)',
              loanDate: "date (optional, 'YYYY-MM-DD')",
              dueDate: "date (optional, 'YYYY-MM-DD')",
              items: 'array (required) — [{ documentCopyId:number, note?:string }]',
            },
            examples: [
              '{ "readerId": 10, "librarianId": 2, "items":[{"documentCopyId":101 }]}'
            ]
          },

          // ================== DUYỆT PHIẾU ĐẶT TRƯỚC ==================
          {
            method: 'POST',
            path: '/api/loans/admin/reservations/:loanSlipId/approve',
            description: 'Duyệt phiếu đặt trước (borrowForm=RESERVATION) → WAITING_FOR_PICKUP; gán bản sao & chốt cọc',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)'
            },
            body: {
              librarianId: 'number (required) — người duyệt',
              dueDate: "date (optional, 'YYYY-MM-DD')",
              pricingMode: "string (optional, 'AUTO_MIN' | 'AUTO_MAX' | 'MANUAL', default='AUTO_MIN')",
              assignments: 'array (optional; chỉ định bản sao) — [{ loanDetailId:number, documentCopyId:number }]',
            },
            response: {
              success: 'boolean',
              message: 'string',
              loanSlipId: 'number',
              slipStatus: 'string (WAITING_FOR_PICKUP)',
            }
          },

          // =====================================================================
          // ===================   CÁC API MỚI (THEO YÊU CẦU)  =====================
          // =====================================================================

          // 1) PICKUP — độc giả đến lấy
          {
            method: 'POST',
            path: '/api/loans/admin/slips/:loanSlipId/pickup',
            description: 'Xác nhận độc giả đến lấy (PICKUP) — chuyển sang BORROWING và gán loanDate/dueDate',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)'
            },
            body: {
              librarianId: 'number (required)',
              pickupDate: "date (optional, 'YYYY-MM-DD') — nếu không truyền sẽ dùng ngày hiện tại",
              dueDate: "date (optional, 'YYYY-MM-DD')",
              items: 'array (optional) — nếu chỉ pickup một số tài liệu',
              preserveLoanDate: 'boolean (optional, default=false)'
            },
            response: {
              success: 'boolean',
              message: 'string',
              slipStatus: 'BORROWING'
            }
          },

          // 2) XÓA 1 TÀI LIỆU KHỎI PHIẾU
          {
            method: 'DELETE',
            path: '/api/loans/admin/slips/:loanSlipId/details/:loanDetailId',
            description: 'Xóa 1 tài liệu khỏi phiếu. Nếu tài liệu cuối cùng → hệ thống tự hủy toàn bộ phiếu',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)',
              loanDetailId: 'number (required)'
            },
            body: {
              librarianId: 'number (required)',
              reason: 'string (optional, lưu vào note và gửi email)'
            },
            response: {
              success: 'boolean',
              message: 'string',
              deletedSlip: 'boolean — true nếu phiếu bị xóa hoàn toàn'
            }
          },

          // 3) HỦY TOÀN BỘ PHIẾU
          {
            method: 'DELETE',
            path: '/api/loans/admin/slips/:loanSlipId',
            description: 'Hủy toàn bộ phiếu mượn — trả bản sao, xóa loanDetails, gửi email hủy phiếu',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)'
            },
            body: {
              librarianId: 'number (required)',
              reason: 'string (optional, lưu vào note và gửi email)'
            },
            response: {
              success: 'boolean',
              message: 'string'
            }
          },

          // 4) HỦY PHIẾU ĐẶT TRƯỚC (MỚI) — PENDING (chưa có bản sao)
          {
            method: 'DELETE',
            path: '/api/loans/admin/reservations/:loanSlipId',
            description: 'Hủy phiếu đặt trước ở trạng thái PENDING (chưa gán bản sao). Lý do lưu vào cột note của phiếu; gửi email thông báo cho độc giả (nếu có email).',
            auth: true,
            role: 'Admin (roleId = 1), Librarian (roleId = 2)',
            params: {
              loanSlipId: 'number (required)'
            },
            body: {
              librarianId: 'number (required) — người hủy',
              reason: 'string (optional, lưu vào LoanSlip.note và gửi trong email)'
            },
            behavior: [
              'Kiểm tra phiếu tồn tại và đang ở trạng thái PENDING (nếu không: 409 error).',
              'Lưu "reason" vào cột note của LoanSlip.',
              'Xóa tất cả LoanDetail liên quan (chúng không có documentCopyId).',
              'Xóa LoanSlip.',
              'Gửi email thông báo hủy phiếu cho độc giả (nếu có account.email), nội dung bao gồm lý do và danh sách tài liệu đã đặt (title/ids).',
              'Nếu không có email độc giả, có thể fallback gửi tới ADMIN_NOTIFICATION_EMAIL (nếu cấu hình).'
            ],
            response: {
              success: 'boolean',
              message: 'string — ví dụ: "Đã hủy phiếu đặt trước thành công"',
              loanSlipId: 'number'
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
              items: 'array [{ documentId:number}] (required)',
              note: 'string (optional)'
            }
          }
        ]
      },
      {
        group: 'Notifications',
        icon: '🔔',
        routes: [
          {
            method: 'GET',
            path: '/api/notifications',
            description: 'Lấy danh sách thông báo của user hiện tại (phân trang, tìm kiếm, lọc theo trạng thái đọc)',
            auth: true,
            role: 'Reader (roleId = 3) hoặc bất kỳ tài khoản có readerId',
            query: {
              page: 'number (optional, default=1)',
              limit: 'number (optional, default=20, max=200)',
              isRead: "0|1 (optional) - lọc theo trạng thái đọc",
              q: 'string (optional) - tìm kiếm theo title hoặc content',
              sortBy: 'string (optional, default="created_at")',
              sortDir: 'string (optional, "ASC" | "DESC", default="DESC")'
            },
            response: {
              success: 'boolean',
              pagination: '{ page, limit, total, totalPages }',
              data: '[{ notification object }]'
            },
            example: {
              request: 'GET /api/notifications?page=1&limit=20&isRead=0&q=thông%20báo',
              response: {
                success: true,
                pagination: { page: 1, limit: 20, total: 12, totalPages: 1 },
                data: [
                  {
                    notificationID: 101,
                    readerId: 12,
                    type: 'SYSTEM',
                    title: 'Thông báo bảo trì thư viện',
                    content: 'Thư viện đóng cửa vào thứ 7',
                    isRead: 0,
                    created_at: '2025-11-10T08:00:00Z'
                  }
                ]
              }
            }
          },
          {
            method: 'GET',
            path: '/api/notifications/:id',
            description: 'Lấy chi tiết 1 thông báo (user chỉ được xem thông báo của chính mình)',
            auth: true,
            params: {
              id: 'number (required) - notificationID'
            },
            response: {
              success: 'boolean',
              data: 'notification object'
            },
            example: {
              request: 'GET /api/notifications/101',
              response: {
                success: true,
                data: {
                  notificationID: 101,
                  readerId: 12,
                  type: 'SYSTEM',
                  title: 'Thông báo bảo trì thư viện',
                  content: 'Thư viện đóng cửa vào thứ 7',
                  isRead: 0,
                  readAt: null,
                  created_at: '2025-11-10T08:00:00Z'
                }
              }
            }
          },
          {
            method: 'POST',
            path: '/api/notifications/:id/mark-read',
            description: 'Đánh dấu 1 thông báo là đã đọc (update isRead=true, readAt=now)',
            auth: true,
            params: {
              id: 'number (required) - notificationID'
            },
            response: {
              success: 'boolean',
              data: 'updated notification object (isRead: 1, readAt: datetime)'
            },
            example: {
              request: 'POST /api/notifications/101/mark-read',
              response: {
                success: true,
                data: { notificationID: 101, isRead: 1, readAt: '2025-11-11T09:12:00Z' }
              }
            }
          },
          {
            method: 'POST',
            path: '/api/notifications/:id/mark-unread',
            description: 'Đánh dấu 1 thông báo là chưa đọc (isRead=false, readAt=null)',
            auth: true,
            params: {
              id: 'number (required) - notificationID'
            },
            response: {
              success: 'boolean',
              data: 'updated notification object (isRead: 0, readAt: null)'
            }
          },
          {
            method: 'POST',
            path: '/api/notifications/mark-all-read',
            description: 'Đánh dấu tất cả thông báo của user hiện tại là đã đọc',
            auth: true,
            body: {
              // không cần body — dùng readerId từ token
            },
            response: {
              success: 'boolean',
              updated: 'number - số bản ghi đã cập nhật'
            },
            example: {
              request: 'POST /api/notifications/mark-all-read',
              response: { success: true, updated: 8 }
            }
          },
          {
            method: 'POST',
            path: '/api/notifications/create',
            description: 'Tạo thông báo (dành cho admin/test) - tạo 1 thông báo cho 1 reader cụ thể',
            auth: true,
            note: 'Nên giới hạn endpoint này cho Admin/Librarian bằng middleware trước khi đưa vào production',
            body: {
              readerId: 'number (required) - ID độc giả nhận thông báo',
              type: 'string (optional) - e.g. SYSTEM, INFO, ALERT',
              title: 'string (required, max 200 chars)',
              content: 'string (optional)',
              link: 'string (optional) - URL liên kết',
              priority: "string (optional) - 'NORMAL'|'HIGH' (default='NORMAL')"
            },
            response: {
              success: 'boolean',
              data: 'created notification object'
            },
            example: {
              request: {
                readerId: 12,
                type: 'SYSTEM',
                title: 'Nhắc trả sách',
                content: 'Bạn có 1 sách đến hạn trả vào ngày mai'
              },
              response: {
                success: true,
                data: {
                  notificationID: 999,
                  readerId: 12,
                  title: 'Nhắc trả sách',
                  isRead: 0,
                  created_at: '2025-11-17T03:00:00Z'
                }
              }
            }
          }
        ]
      },
      {
  group: 'Cart',
  icon: '🛒',
  routes: [
    {
      method: 'GET',
      path: '/api/cart',
      description: 'Lấy giỏ sách của độc giả hiện tại',
      auth: true,
      role: 'Reader (roleId = 3)'
    },
    {
      method: 'POST',
      path: '/api/cart/add',
      description: 'Thêm tài liệu vào giỏ',
      auth: true,
      role: 'Reader (roleId = 3)',
      body: {
        documentId: 'number (required)'
      }
    },
    {
      method: 'DELETE',
      path: '/api/cart/:documentId',
      description: 'Xoá 1 tài liệu khỏi giỏ',
      auth: true,
      role: 'Reader (roleId = 3)',
      params: {
        documentId: 'number'
      }
    },
    {
      method: 'DELETE',
      path: '/api/cart',
      description: 'Xoá toàn bộ giỏ sách',
      auth: true,
      role: 'Reader (roleId = 3)'
    }
  ]
},
{
  group: 'Favorite',
  icon: '❤️',
  routes: [
    {
      method: 'GET',
      path: '/api/favorite',
      description: 'Lấy danh sách tài liệu yêu thích của độc giả',
      auth: true,
      role: 'Reader (roleId = 3)'
    },
    {
      method: 'POST',
      path: '/api/favorite/add',
      description: 'Thêm tài liệu vào danh sách yêu thích',
      auth: true,
      role: 'Reader (roleId = 3)',
      body: {
        documentId: 'number (required)'
      }
    },
    {
      method: 'DELETE',
      path: '/api/favorite/:documentId',
      description: 'Xóa 1 tài liệu khỏi danh sách yêu thích',
      auth: true,
      role: 'Reader (roleId = 3)',
      params: {
        documentId: 'number'
      }
    },
    {
      method: 'DELETE',
      path: '/api/favorite',
      description: 'Xóa toàn bộ danh sách yêu thích',
      auth: true,
      role: 'Reader (roleId = 3)'
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
          },
          {
            method: 'POST',
            path: '/api/debug/run-notification-job',
            description: 'Tạo job debug',
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