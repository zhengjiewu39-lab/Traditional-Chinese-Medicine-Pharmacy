import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await authApi.getCurrentUser();
          setUser(response.data);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const applyUser = (user, token) => {
    if (token) localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const login = async (username, password, extra = {}) => {
    try {
      const response = await authApi.login({ username, password, ...extra });
      
      if (response.data.success) {
        return applyUser(response.data.user, response.data.token);
      } else {
        throw new Error(response.data.message || '登录失败');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(error.response?.data?.message || error.message || '登录失败，请检查用户名和密码');
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const assumePatient = async (patientRef) => {
    const response = await authApi.assumePatient(patientRef);
    return applyUser(response.data.user, response.data.token);
  };

  const value = {
    user,
    loading,
    login,
    assumePatient,
    logout,
    role: user?.role,
    isAdmin: user?.role === 'admin',
    isPharmacist: user?.role === 'pharmacist',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 