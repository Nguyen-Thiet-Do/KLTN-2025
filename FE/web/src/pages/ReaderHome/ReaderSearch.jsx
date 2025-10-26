import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { documentApi } from "../../services/documentApi";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderCard from "../../components/layouts/ReaderCard";
import "./ReaderHome.css";





export default function ReaderSearch() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const query = params.get("q") || "";
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    documentApi
      .search({ q: query })
      .then((res) => setDocs(res.data.data || []))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <>
      <ReaderHeader />
      <div className="reader-home">
        <main className="reader-main">
          <h2>
            Kết quả tìm kiếm cho:{" "}
            <span style={{ color: "#00796b" }}>{query}</span>
          </h2>
          {loading ? (
            <p>Đang tải...</p>
          ) : docs.length ? (
            <div className="reader-grid">
              {docs.map((d) => (
                <ReaderCard key={d.documentId} doc={d} />
              ))}
            </div>
          ) : (
            <p>Không tìm thấy tài liệu phù hợp.</p>
          )}
        </main>
      </div>
    </>
  );
}
