// src/components/Loading/ButtonLoader.jsx
import Lottie from "lottie-react";
import book from "../Loading/jsonLoading/Open book.json";

export default function ButtonLoader({
  inline = false,
  size = inline ? 30 : 160,
  className = "",
}) {
  const anim = (
    <Lottie
      animationData={book}
      loop
      style={{ width: size, height: size }}
      className={className}
    />
  );

  if (inline) return anim;        // dùng trong Button

  // Overlay toàn trang (nếu muốn dùng dạng phủ màn)
  return (
    <div className="fixed inset-0 grid place-items-center bg-white/80 z-50">
      {anim}
      <span className="mt-3 text-gray-600">Đang tải dữ liệu...</span>
    </div>
  );
}
