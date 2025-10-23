import { Player } from "@lottiefiles/react-lottie-player";
import book from "../../assets/Book.json"; // đặt file vào src/assets

export default function BookLoader() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-white/80 z-50">
      <Player autoplay loop src={book} style={{ width: 160, height: 160 }} />
      <span className="mt-3 text-gray-600">Đang tải dữ liệu...</span>
    </div>
  );
}
