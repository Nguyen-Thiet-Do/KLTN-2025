import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    if (user) {
      const routes = {
        1: '/admin',
        2: '/librarian',
        3: '/',
      };
      navigate(routes[user.roleId] || '/login');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f4f6'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: '500px'
      }}>
        <h1 style={{ fontSize: '72px', margin: 0, color: '#ef4444' }}>403</h1>
        <h2 style={{ fontSize: '24px', marginTop: '20px', color: '#333' }}>
          Truy Cập Bị Từ Chối
        </h2>
        <p style={{ color: '#6b7280', marginTop: '10px' }}>
          Bạn không có quyền truy cập vào trang này
        </p>
        <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={handleGoBack}
            style={{
              padding: '12px 24px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Quay Lại
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Đăng Xuất
          </button>
        </div>
      </div>
    </div>
  );
}