import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { auth, supabase } from './supabase';
import type { Employee } from './types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  employee: Employee | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Preview mode: auto-login via URL param using real auth session
    // SECURITY: Strictly localhost only. Never allow on deployed domains.
    if (import.meta.env.VITE_PREVIEW_MODE) {
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      if (isLocalhost) {
        const urlEmail = new URLSearchParams(window.location.search).get('email');
        const previewEmail = urlEmail || localStorage.getItem('boon_preview_email');
        if (previewEmail) {
          if (urlEmail) localStorage.setItem('boon_preview_email', previewEmail);
          previewLogin(previewEmail);
          // Don't return - let onAuthStateChange handle the session once OTP verifies
        }
      }
    }

    // Get initial session
    auth.getSession().then(async ({ session }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.email) {
        fetchEmployeeProfile(session.user.email, session.access_token);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user?.email) {
        // Link auth user to employee record in background (don't block)
        auth.linkAuthUserToEmployee(session.user.email, session.user.id)
          .catch(err => console.error('Link error:', err));
        // Record login event for analytics (don't block)
        auth.recordLogin(session.user.email, session.user.id, navigator.userAgent)
          .catch(err => console.error('Login tracking error:', err));
        // Fetch employee profile using the user's access token
        await fetchEmployeeProfile(session.user.email, session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setEmployee(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchEmployeeProfile(email: string, accessToken: string) {
    try {
      // Use raw fetch with user's JWT token for RLS
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/employee_manager?company_email=ilike.${encodeURIComponent(email)}&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Error fetching employee:', data);
        setEmployee(null);
      } else if (data && data.length > 0) {
        setEmployee(data[0] as Employee);
      } else {
        setEmployee(null);
      }
    } catch (err) {
      console.error('Error in fetchEmployeeProfile:', err);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }

  async function previewLogin(email: string) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const previewSecret = import.meta.env.VITE_PREVIEW_SECRET;

      if (!previewSecret) {
        console.error('VITE_PREVIEW_SECRET not set');
        setLoading(false);
        return;
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/preview-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email, preview_secret: previewSecret }),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Preview login failed:', err);
        setLoading(false);
        return;
      }

      const { token_hash } = await response.json();

      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'email',
      });

      if (error) {
        console.error('OTP verification failed:', error);
        setLoading(false);
      }
      // On success, onAuthStateChange fires SIGNED_IN and handles the rest
    } catch (err) {
      console.error('Preview login error:', err);
      setLoading(false);
    }
  }

  async function signOut() {
    await auth.signOut();
    localStorage.removeItem('boon_preview_email');
    setUser(null);
    setSession(null);
    setEmployee(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, employee, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
