// src/contexts/AuthContext.jsx 
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
          
          // ✅ FIX: Merge đúng cách với email và phoneNumber từ account
          const userData = {
            // Account fields
            accountId: accountData.accountId,
            roleId: accountData.roleId,
            email: accountData.email,
            phoneNumber: accountData.phoneNumber,
            status: accountData.status,
            
            // Profile fields
            ...profileData,
          };
          
          console.log('✅ Init auth - userData:', userData);
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
      
      // ✅ FIX: Merge đầy đủ account + profile với email và phoneNumber
      const userData = {
        // Account fields - IMPORTANT: phải lấy email và phoneNumber từ account
        accountId: account.accountId,
        roleId: account.roleId,
        email: account.email,
        phoneNumber: account.phoneNumber,
        status: account.status,
        
        // Profile fields (readerId, fullName, gender, dateOfBirth, cccd, address,...)
        ...profile,
      };

      console.log('✅ Login success - userData:', userData);
      
      // Update state
      setUser(userData);
      
      return { account, profile, data: response.data };
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
    
    // Update sessionStorage
    const profileKeys = ['readerId', 'fullName', 'gender', 'dateOfBirth', 
                        'phoneNumber', 'cccd', 'address', 'avatar'];
    const profileData = {};
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
    
    console.log('✅ New user data:', newUserData);
    
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
      const updatedProfile = { ...existingProfile, ...profileData };
      sessionStorage.setItem('profile', JSON.stringify(updatedProfile));
      console.log('✅ Profile updated in sessionStorage:', updatedProfile);
    }
    
    // Cập nhật account trong sessionStorage
    if (Object.keys(accountData).length > 0) {
      const existingAccount = JSON.parse(sessionStorage.getItem('account') || '{}');
      const updatedAccount = { ...existingAccount, ...accountData };
      sessionStorage.setItem('account', JSON.stringify(updatedAccount));
      console.log('✅ Account updated in sessionStorage:', updatedAccount);
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