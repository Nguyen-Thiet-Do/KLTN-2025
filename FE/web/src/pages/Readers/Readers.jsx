import "./Readers.css";
import { FaPlus, FaSearch, FaFilter, FaTrash, FaEdit } from "react-icons/fa";
import { useState, useEffect, useMemo } from "react";
import { getReaders, deleteReader } from "../../services/readerService";
import AddReader from "./AddReader";
import EditReader from "./EditReader";

export default function Readers() {
  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReader, setEditingReader] = useState(null);

  // 🔍 Thanh tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");

  // 🔢 Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 🔄 Lấy danh sách độc giả
  const fetchReaders = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await getReaders(token);
      if (res.success) setReaders(res.readers);
      else setError("Không thể tải danh sách độc giả.");
    } catch (err) {
      setError("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReaders();
  }, []);

  // 🗑️ Xóa độc giả
  const handleDelete = async (id, name) => {
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa độc giả "${name}" không?`);
    if (!confirmDelete) return;

    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await deleteReader(id, token);
      if (res.success) {
        alert("Đã xóa độc giả thành công!");
        fetchReaders();
      } else {
        alert(res.message || "Không thể xóa độc giả.");
      }
    } catch (err) {
      alert("Lỗi khi xóa: " + (err.response?.data?.message || err.message));
    }
  };

  // 👀 Chuẩn hoá hiển thị giới tính
  const getGenderDisplay = (gender) => {
    if (!gender) return "-";
    if (typeof gender === "object" && gender?.type === "Buffer" && Array.isArray(gender.data)) {
      const value = gender.data[0];
      if (value === 1) return "Nam";
      if (value === 0) return "Nữ";
      return "-";
    }
    const g = gender.toString().toLowerCase();
    if (["1", "male"].includes(g)) return "Nam";
    if (["0", "female"].includes(g)) return "Nữ";
    if (["other", "khac"].includes(g)) return "Khác";
    return "-";
  };

  // 🔎 Lọc kết quả theo thanh tìm kiếm
  const filteredReaders = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return readers;
    return readers.filter(
      (r) =>
        r.fullName?.toLowerCase().includes(keyword) ||
        r.email?.toLowerCase().includes(keyword)
    );
  }, [readers, searchQuery]);

  // 📖 Dữ liệu phân trang
  const totalPages = Math.ceil(filteredReaders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentReaders = filteredReaders.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="readers-page">
      <h2>Quản lý Độc giả</h2>

      {/* Thanh công cụ */}
      <div className="reader-toolbar">
        <button className="btn btn-list" onClick={fetchReaders}>
          Danh sách Độc giả
        </button>
        <button className="btn btn-add" onClick={() => setShowAddModal(true)}>
          <FaPlus /> Thêm Độc giả mới
        </button>
      </div>

      {/* Ô tìm kiếm */}
      <div className="reader-search">
        <div className="search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Tìm kiếm độc giả theo tên hoặc email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // reset về trang 1 khi tìm kiếm
            }}
          />
        </div>
        <FaFilter className="filter-icon" />
      </div>

      {/* Hiển thị trạng thái */}
      {loading && <p>Đang tải...</p>}
      {error && <p className="error">{error}</p>}

      {/* Bảng dữ liệu */}
      {!loading && !error && (
        <div className="reader-table">
          <table>
            <thead>
              <tr>
                <th>Mã độc giả</th>
                <th>Họ tên</th>
                <th>Giới tính</th>
                <th>Ngày sinh</th>
                <th>Email</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {currentReaders.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                currentReaders.map((r) => (
                  <tr key={r.readerId}>
                    <td>{`DG${r.readerId}`}</td>
                    <td>{r.fullName}</td>
                    <td>{getGenderDisplay(r.gender)}</td>
                    <td>
                      {r.dateOfBirth
                        ? new Date(r.dateOfBirth).toLocaleDateString("vi-VN")
                        : "-"}
                    </td>
                    <td>{r.email}</td>
                    <td>
                      <button className="btn-edit" onClick={() => setEditingReader(r)}>
                        <FaEdit /> Sửa
                      </button>{" "}
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(r.readerId, r.fullName)}
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

      {/* Modal thêm độc giả */}
      {showAddModal && (
        <AddReader
          onSuccess={() => {
            setShowAddModal(false);
            fetchReaders();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {/* Modal sửa độc giả */}
      {editingReader && (
        <EditReader
          reader={editingReader}
          onSuccess={() => {
            setEditingReader(null);
            fetchReaders();
          }}
          onCancel={() => setEditingReader(null)}
        />
      )}
    </div>
  );
}
