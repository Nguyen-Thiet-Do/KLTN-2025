import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useState } from "react";
import "./ReaderHeader.css";

export default function ReaderHeader() {
  const { pathname } = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const [search, setSearch] = useState("");

  const tabs = [
    { path: "/", label: "Trang chủ" },
    { path: "/books", label: "Sách" },
    { path: "/newspapers", label: "Báo" },
    { path: "/magazines", label: "Tạp chí" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const keyword = search.trim();
    if (keyword) navigate(`/search?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <header className="reader-header">
      {/* Logo + menu */}
      <div className="left-section">
        <div className="logo-wrap" onClick={() => navigate("/")}>
          <img src="/logoo.png" alt="Logo Thư Viện" className="logo-img" />
          <div className="logo-text">Thư Viện Book-Tech</div>
        </div>

        <nav className="nav-links">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={pathname === tab.path ? "active" : ""}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

    <form className="search-bar" onSubmit={(e) => e.preventDefault()}>
  <input
    type="text"
    placeholder="Tìm kiếm tài liệu..."
    value={search}
    onChange={(e) => {
      const value = e.target.value;
      setSearch(value);
      if (value.trim()) {
        navigate(`/search?q=${encodeURIComponent(value.trim())}`);
      }
    }}
  />
  <button type="button">
    <i className="fas fa-search"></i>
  </button>
</form>


      {/* Tài khoản */}
      <div className="auth-section">
        {!isAuthenticated ? (
          <>
            <button onClick={() => navigate("/login")} className="login-btn">
              Đăng nhập
            </button>
            <button onClick={() => navigate("/signup")} className="register-btn">
              Đăng ký
            </button>
          </>
        ) : (
          <div className="user-menu">
            <div className="avatar" onClick={() => setOpenMenu(!openMenu)}>
              {user.fullName?.[0]?.toUpperCase() ||
                user.email?.[0]?.toUpperCase()}
            </div>
            {openMenu && (
              <div className="dropdown">
                <div className="user-info">
                  <strong>{user.fullName || "User"}</strong>
                  <span>{user.email}</span>
                  <small>{user.roleName}</small>
                </div>
                <hr />
                <button onClick={() => navigate("/profile")}>Profile</button>
                <button onClick={() => navigate("/settings")}>Settings</button>
                <hr />
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
