import { useEffect, useState } from "react";
import { documentApi } from "../../services/documentApi";
import "./ReaderSidebar.css";

export default function ReaderSidebar({ selected, onSelect }) {
  const [genres, setGenres] = useState([]);

  useEffect(() => {
    documentApi.genres().then((res) => {
      setGenres(res.data.data || []);
    });
  }, []);

  return (
    <aside className="reader-sidebar">
      <h3>Danh mục</h3>
      <ul>
        {genres.map((g) => (
          <li
            key={g.genreId}
            className={selected === g.genreId ? "active" : ""}
            onClick={() => onSelect(g.genreId)}
          >
            {g.name}
          </li>
        ))}
      </ul>
    </aside>
  );
}
