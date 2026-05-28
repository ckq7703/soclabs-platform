import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/labApi';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/user/');
      const userData = response.data;
      setUser(userData);
      setGuacUserCookie(userData);
    } catch (error) {
      setUser(null);
      localStorage.removeItem('lab_access_token');
      localStorage.removeItem('lab_refresh_token');
      document.cookie = "lab_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
      document.cookie = "guac_user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    } finally {
      setLoading(false);
    }
  };

  const setGuacUserCookie = (userData) => {
    const email = userData?.email;
    const username = userData?.username;
    const guacUser = email || username;
    if (guacUser) {
      document.cookie = `guac_user=${encodeURIComponent(guacUser)}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('lab_access_token');
    if (token) {
      document.cookie = `lab_access_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      fetchUser().then(() => {
        // guac_user cookie is set inside fetchUser or login
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login/', { username, password });
      const { access, refresh } = response.data;
      
      localStorage.setItem('lab_access_token', access);
      localStorage.setItem('lab_refresh_token', refresh);
      
      // Write token to cookie for Nginx SSO
      document.cookie = `lab_access_token=${access}; path=/; max-age=86400; SameSite=Lax`;
      
      // Fetch user data immediately
      const userResponse = await api.get('/auth/user/');
      const userData = userResponse.data;
      setUser(userData);
      setGuacUserCookie(userData);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('lab_access_token');
    localStorage.removeItem('lab_refresh_token');
    document.cookie = "lab_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    document.cookie = "guac_user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
