import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = sessionStorage.getItem('pos_authenticated') === 'true';
    setIsAuthenticated(auth);

    if (!auth && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [navigate, location.pathname]);

  const logout = () => {
    sessionStorage.removeItem('pos_authenticated');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return { isAuthenticated, logout };
}
