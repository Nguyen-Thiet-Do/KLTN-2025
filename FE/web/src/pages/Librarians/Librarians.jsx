import "./Librarians.css";
import { FaPlus, FaSearch, FaFilter, FaTrash, FaEdit } from "react-icons/fa";
import { useEffect, useState, useMemo } from "react";
import { getLibrarians, deleteLibrarian } from "../../services/librarianService";
import AddLibrarian from "./AddLibrarian";
import EditLibrarian from "./EditLibrarian";

export default function Librarians() {
  const [librarians, setLibrarians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLibrarian, setEditingLibrarian] = useState(null);

  // 🔍 Tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");

  // 🔢 Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 🔄 Lấy danh sách thủ thư
  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        setError("Không tìm thấy token. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }

      const data = await getLibrarians(token);
      if (data.success) setLibrarians(data.librarians);
      else setError("Không thể tải danh sách thủ thư.");
    } catch (err) {
      console.error("Chi tiết lỗi:", err.response || err);
      if (err.response?.status === 401) {
        setError("Token không hợp lệ hoặc đã hết hạn.");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
      } else {
        setError("Lỗi khi tải dữ liệu: " + (err.response?.data?.message || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 👀 Hiển thị giới tính (chuẩn như bên Độc giả)
  const getGenderDisplay = (gender) => {
    if (!gender) return "-";

    // Sequelize có thể trả Buffer hoặc Uint8Array
    if (typeof gender === "object") {
      const value =
        gender?.data?.[0] ??
        (gender instanceof Uint8Array ? gender[0] : undefined);
      if (value === 1) return "Nam";
      if (value === 0) return "Nữ";
      return "Khác";
    }

    // Chuẩn hoá dạng chuỗi
    const g = gender.toString().trim().toLowerCase();
    if (["male", "nam", "1"].includes(g)) return "Nam";
    if (["female", "nu", "nữ", "0"].includes(g)) return "Nữ";
    if (["other", "khac", "khác"].includes(g)) return "Khác";
    return "-";
  };

  // 🗑️ Xóa thủ thư
  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa thủ thư "${name}" không?`);
    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await deleteLibrarian(id, token);
      if (res.success) {
        alert("Đã xóa thủ thư thành công!");
        fetchData();
      } else alert(res.message || "Không thể xóa thủ thư.");
    } catch (err) {
      alert("Xóa thất bại: " + (err.response?.data?.message || err.message));
    }
  };

  // 🔎 Lọc thủ thư theo tên hoặc email
  const filteredLibrarians = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return librarians;
    return librarians.filter(
      (lib) =>
        lib.fullName?.toLowerCase().includes(keyword) ||
        lib.email?.toLowerCase().includes(keyword)
    );
  }, [librarians, searchQuery]);

  // 📄 Phân trang
  const totalPages = Math.ceil(filteredLibrarians.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLibrarians = filteredLibrarians.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="librarian-page">
      <h2>Quản lý Thủ thư</h2>

      {/* Thanh công cụ */}
      <div className="librarian-toolbar">
        <button className="btn btn-list" onClick={fetchData}>
          Danh sách Thủ thư
        </button>
        <button className="btn btn-add" onClick={() => setShowAddModal(true)}>
          <FaPlus /> Thêm Thủ thư mới
        </button>
      </div>

      {/* Ô tìm kiếm */}
      <div className="librarian-search">
        <div className="search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <FaFilter className="filter-icon" />
      </div>

      {loading && <p>Đang tải dữ liệu...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="librarian-table">
          <table>
            <thead>
              <tr>
                <th>Mã thủ thư</th>
                <th>Họ tên</th>
                <th>Giới tính</th>
                <th>Ngày sinh</th>
                <th>Email</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {currentLibrarians.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                currentLibrarians.map((lib) => (
                  <tr key={lib.librarianId}>
                    <td>{lib.librarianCode || `TT${lib.librarianId}`}</td>
                    <td>{lib.fullName}</td>
                    <td>{getGenderDisplay(lib.gender)}</td>
                    <td>
                      {lib.dateOfBirth
                        ? new Date(lib.dateOfBirth).toLocaleDateString("vi-VN")
                        : "-"}
                    </td>
                    <td>{lib.email}</td>
                    <td>
                      <button
                        className="btn-edit"
                        onClick={() => setEditingLibrarian(lib)}
                      >
                        <FaEdit /> Sửa
                      </button>{" "}
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(lib.librarianId, lib.fullName)}
                      >
                        <FaTrash /> Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 📜 Phân trang */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={currentPage === i + 1 ? "active" : ""}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau
              </button>
            </div>
          )}
        </div>
      )}

      {/* ➕ Modal thêm thủ thư */}
      {showAddModal && (
        <AddLibrarian
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {/* ✏️ Modal sửa thủ thư */}
      {editingLibrarian && (
        <EditLibrarian
          librarian={editingLibrarian}
          onSuccess={() => {
            setEditingLibrarian(null);
            fetchData();
          }}
          onCancel={() => setEditingLibrarian(null)}
        />
      )}
    </div>
  );
}
