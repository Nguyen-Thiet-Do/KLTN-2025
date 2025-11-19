import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Kiểm tra token khi app load
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = sessionStorage.getItem('accessToken');
        const storedAccount = sessionStorage.getItem('account');
        const storedProfile = sessionStorage.getItem('profile');
        
        if (token && storedAccount) {
          const accountData = JSON.parse(storedAccount);
          const profileData = storedProfile ? JSON.parse(storedProfile) : {};
          
          // Merge account và profile
          const userData = {
            ...accountData,
            ...profileData
          };
          
          setUser(userData);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        sessionStorage.clear();
        setError('Failed to initialize authentication');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const response = await authService.login(email, password);

      if (!response.success) {
        throw new Error(response.message || 'Login failed');
      }

      const { account, profile, accessToken, refreshToken } = response.data;

      // Lưu tokens
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
      
      // Lưu account data
      sessionStorage.setItem('account', JSON.stringify(account));
      
      // Lưu profile data
      if (profile) {
        sessionStorage.setItem('profile', JSON.stringify(profile));
      }
      
      // Merge account + profile để hiển thị đầy đủ thông tin
      const userData = {
        accountId: account.accountId,
        roleId: account.roleId,
        email: account.email,
        ...profile   // chứa readerId, fullName,...
      };

      // Update state
      setUser(userData);
      
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      // Optional: Gọi API logout nếu BE yêu cầu
      // await authService.logout();
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      // Xóa dữ liệu dù có lỗi hay không
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('account');
      sessionStorage.removeItem('profile');
      setUser(null);
    }
  };

  const updateUserProfile = (updatedData) => {
    const newUserData = { ...user, ...updatedData };
    setUser(newUserData);
    
    // Update profile nếu dữ liệu là từ profile
    const profileKeys = ['avatar', 'phone', 'address', 'department', 'position'];
    const accountData = {};
    
    Object.keys(updatedData).forEach(key => {
      if (profileKeys.includes(key)) {
        profileData[key] = updatedData[key];
      } else {
        accountData[key] = updatedData[key];
      }
    });
    
    if (Object.keys(profileData).length > 0) {
      const existingProfile = JSON.parse(sessionStorage.getItem('profile') || '{}');
      sessionStorage.setItem('profile', JSON.stringify({ ...existingProfile, ...profileData }));
    }
    
    if (Object.keys(accountData).length > 0) {
      const existingAccount = JSON.parse(sessionStorage.getItem('account') || '{}');
      sessionStorage.setItem('account', JSON.stringify({ ...existingAccount, ...accountData }));
    }
  };

  // ✅ THÊM HÀM MỚI: updateUserContext (tương tự updateUserProfile nhưng đơn giản hơn)
  const updateUserContext = (updatedData) => {
    // Merge dữ liệu mới vào user hiện tại
    const newUserData = { 
      ...user, 
      ...updatedData 
    };
    
    // Cập nhật state
    setUser(newUserData);
    
    // Cập nhật sessionStorage
    // Phân loại dữ liệu thuộc profile hay account
    const profileKeys = [
      'readerId', 'fullName', 'gender', 'dateOfBirth', 
      'phoneNumber', 'cccd', 'address', 'avatar'
    ];
    
    const profileData = {};
    const accountData = {};
    
    Object.keys(updatedData).forEach(key => {
      if (profileKeys.includes(key)) {
        profileData[key] = updatedData[key];
      } else {
        accountData[key] = updatedData[key];
      }
    });
    
    // Cập nhật profile trong sessionStorage
    if (Object.keys(profileData).length > 0) {
      const existingProfile = JSON.parse(sessionStorage.getItem('profile') || '{}');
      sessionStorage.setItem('profile', JSON.stringify({ 
        ...existingProfile, 
        ...profileData 
      }));
    }
    
    // Cập nhật account trong sessionStorage
    if (Object.keys(accountData).length > 0) {
      const existingAccount = JSON.parse(sessionStorage.getItem('account') || '{}');
      sessionStorage.setItem('account', JSON.stringify({ 
        ...existingAccount, 
        ...accountData 
      }));
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    updateUserProfile,
    updateUserContext, // ✅ THÊM VÀO ĐÂY
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};