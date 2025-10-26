import { useEffect, useState } from "react";
import { documentApi } from "../../services/documentApi";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderSidebar from "../../components/layouts/ReaderSidebar";
import ReaderCard from "../../components/layouts/ReaderCard";
import "./ReaderHome.css";

export default function ReaderHome({ type = "all" }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState(null);

  // --- Load tài liệu mặc định (tất cả hoặc theo loại) ---
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await documentApi.list({ page: 1, limit: 12, type });
      setDocs(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  // --- Khi chọn danh mục ---
  const handleGenreSelect = async (genreId) => {
    setSelectedGenre(genreId);
    setLoading(true);
    try {
      if (!genreId) {
        await loadDocuments(); // Không chọn thì load lại toàn bộ
        return;
      }
      const res = await documentApi.byGenre({
        genreIds: genreId,
        match: "any",
        page: 1,
        limit: 12,
        type,
      });
      setDocs(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  // --- Lần đầu load ---
  useEffect(() => {
    loadDocuments();
  }, [type]);

  return (
    <>
      <ReaderHeader />
      <div className="reader-home">
        <main className="reader-main">
          <h2>
            {type === "book"
              ? "Danh sách Sách"
              : type === "magazine"
              ? "Tạp chí"
              : type === "newspaper"
              ? "Báo"
              : "Tài liệu mới nhất"}
          </h2>

          {loading ? (
            <p>Đang tải...</p>
          ) : docs.length === 0 ? (
            <p>Không có tài liệu nào.</p>
          ) : (
            <div className="reader-grid">
              {docs.map((d) => (
                <ReaderCard key={d.documentId} doc={d} />
              ))}
            </div>
          )}
        </main>

        {/* Sidebar danh mục */}
        <ReaderSidebar selected={selectedGenre} onSelect={handleGenreSelect} />
      </div>
    </>
  );
}
