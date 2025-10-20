import { useState } from "react";
import { updateReader } from "../../services/readerService";
import "./AddReader.css"; // dùng chung CSS với modal thêm

export default function EditReader({ reader, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    fullName: reader.fullName || "",
    gender: reader.gender || "",
    dateOfBirth: reader.dateOfBirth ? reader.dateOfBirth.split("T")[0] : "",
    address: reader.address || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await updateReader(reader.readerId, form, token);
      if (res.success) {
        alert("✅ Cập nhật độc giả thành công!");
        onSuccess();
      } else setError(res.message || "Cập nhật thất bại");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Lỗi khi cập nhật");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Sửa thông tin độc giả</h3>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            name="fullName"
            placeholder="Họ tên"
            value={form.fullName}
            onChange={handleChange}
            required
          />
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Giới tính</option>
            <option value="1">Nam</option>
            <option value="0">Nữ</option>
            <option value="other">Khác</option>
          </select>
          <input
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={handleChange}
          />
          <input
            name="address"
            placeholder="Địa chỉ"
            value={form.address}
            onChange={handleChange}
          />
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "Lưu thay đổi"}
            </button>
            <button type="button" onClick={onCancel}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
