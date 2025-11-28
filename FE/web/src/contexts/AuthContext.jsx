// src/contexts/AuthContext.jsx 
import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
// ✅ HÀM FETCH USER DATA TỪ API
  const fetchUserData = async (token) => {
    try {
      const getApiBaseUrl = () => {
        const isProduction = window.location.hostname !== 'localhost' 
                          && window.location.hostname !== '127.0.0.1';
        
        if (isProduction) {
          return 'https://kltn-2025-ehsx.onrender.com/api';
        }
        
        return 'http://localhost:8080/api';
      };
      
      const API_BASE_URL = getApiBaseUrl();

      // Gọi API lấy thông tin user hiện tại
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const result = await response.json();
      
      if (result.success) {
        const { account, profile } = result.data;
        
        // Merge account + profile
        const userData = {
          accountId: account.accountId,
          roleId: account.roleId,
          email: account.email,
          phoneNumber: account.phoneNumber,
          ...profile,
          memberCard: profile.memberCard || null,
          cardType: profile.memberCard?.cardType || null
        };

        console.log('✅ Fetched fresh user data:', userData);
        
        // Cập nhật sessionStorage
        sessionStorage.setItem('account', JSON.stringify(account));
        sessionStorage.setItem('profile', JSON.stringify(profile));
        
        return userData;
      }
      
      return null;
    } catch (err) {
      console.error('Error fetching user data:', err);
      throw err;
    }
  };
  // Kiểm tra token khi app load
  // ✅ Kiểm tra token khi app load
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = sessionStorage.getItem('accessToken');

        if (token) {
          console.log('🔄 Token found, fetching fresh user data from API...');
          
          try {
            // ✅ FETCH LẠI USER DATA TỪ SERVER
            const userData = await fetchUserData(token);
            
            if (userData) {
              setUser(userData);
            } else {
              sessionStorage.clear();
            }
          } catch (fetchErr) {
            console.error('❌ Failed to fetch user data, using cached data:', fetchErr);
            
            // Fallback: Dùng data từ sessionStorage nếu API fail
            const storedAccount = sessionStorage.getItem('account');
            const storedProfile = sessionStorage.getItem('profile');
            
            if (storedAccount) {
              const accountData = JSON.parse(storedAccount);
              const profileData = storedProfile ? JSON.parse(storedProfile) : {};
              
              const userData = {
                ...accountData,
                ...profileData
              };
              
              setUser(userData);
            } else {
              sessionStorage.clear();
            }
          }
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
        // Account fields - IMPORTANT: phải lấy email và phoneNumber từ account
        accountId: account.accountId,
        roleId: account.roleId,
        email: account.email,
          phoneNumber: account.phoneNumber,
        ...profile,   // chứa readerId, fullName,...
        memberCard: profile.memberCard || null,  // thêm thông tin thẻ thành viên
        cardType: profile.memberCard?.cardType || null  // thêm loại thẻ
      };

      console.log('✅ Login success - userData:', userData);
      
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
      sessionStorage.removeItem('readerId');
      sessionStorage.removeItem('roleId');
      sessionStorage.removeItem('accountId');
      setUser(null);
    }
  };

 const updateUserProfile = (updatedData) => {
  const newUserData = { ...user, ...updatedData };
  setUser(newUserData);

  const profileKeys = ['avatar', 'phone', 'address', 'department', 'position'];
  const profileData = {};  // ✅ Thêm dòng này
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

  // ✅ HÀM updateUserContext - Đơn giản hơn, chỉ merge vào user
  const updateUserContext = (updatedData) => {
    console.log('📝 Updating user context with:', updatedData);
    
    // Merge dữ liệu mới vào user hiện tại
    const newUserData = {
      ...user,
      ...updatedData
    };

    // Cập nhật state
    setUser(newUserData);

    // Cập nhật sessionStorage
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

 // ✅ HÀM REFRESH USER
  const refreshUser = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No token found');
      }

      console.log('🔄 Refreshing user data from API...');
      
      const userData = await fetchUserData(token);
      
      if (userData) {
        setUser(userData);
        console.log('✅ User data refreshed successfully');
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
      throw err;
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
    updateUserContext,
    refreshUser, // ✅ Thêm dòng này
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