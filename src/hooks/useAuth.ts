import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

type AppRole = 'admin' | 'cashier';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUserRole = useCallback(async (userId: string) => {
    setIsLoadingRole(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching role:', error);
        setUserRole(null);
      } else {
        setUserRole(data?.role as AppRole);
      }
    } catch (err) {
      console.error('Error fetching role:', err);
      setUserRole(null);
    } finally {
      setIsLoadingRole(false);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Defer Supabase calls with setTimeout to avoid deadlock
        setTimeout(() => {
          fetchUserRole(session.user.id);
        }, 0);
      } else {
        setUserRole(null);
        setIsLoadingRole(false);
      }
      
      if (!session && location.pathname !== '/login') {
        navigate('/login');
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setIsLoadingRole(false);
      }
      
      if (!session && location.pathname !== '/login') {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, fetchUserRole]);

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
    setUserRole(null);
    navigate('/login');
  };

  const isAdmin = userRole === 'admin';

  return { isAuthenticated, user, userRole, isAdmin, isLoadingRole, logout };
}