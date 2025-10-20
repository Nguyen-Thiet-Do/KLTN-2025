import { useState } from "react";
import { createReader } from "../../services/readerService";
import "./AddReader.css";

export default function AddReader({ onSuccess, onCancel }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    gender: "",
    dateOfBirth: "",
    phoneNumber: "",
    address: "",
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await createReader(token, form);
      if (res.success) {
        alert("✅ Thêm độc giả thành công!");
        onSuccess();
      } else {
        setError(res.message || "Thêm độc giả thất bại");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Lỗi khi thêm độc giả");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Thêm Độc Giả Mới</h3>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            name="fullName"
            placeholder="Họ tên"
            value={form.fullName}
            onChange={handleChange}
            required
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Mật khẩu"
            value={form.password}
            onChange={handleChange}
            required
          />
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Giới tính</option>
            <option value="1">Nam</option>
            <option value="0">Nữ</option>
          </select>
          <input
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={handleChange}
          />
          <input
            name="phoneNumber"
            placeholder="Số điện thoại"
            value={form.phoneNumber}
            onChange={handleChange}
          />
          <input
            name="address"
            placeholder="Địa chỉ"
            value={form.address}
            onChange={handleChange}
          />
          <textarea
            name="note"
            placeholder="Ghi chú"
            value={form.note}
            onChange={handleChange}
          />
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "Thêm độc giả"}
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
