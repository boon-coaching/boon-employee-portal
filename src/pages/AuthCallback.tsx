import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    function goHome() {
      if (handledRef.current) return;
      handledRef.current = true;
      navigate('/', { replace: true });
    }

    // Primary: listen for Supabase to auto-process the URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        goHome();
      }
    });

    // 10-second timeout: show warning UI instead of infinite spinner
    const timeout = setTimeout(() => {
      if (!handledRef.current) {
        setTimedOut(true);
      }
    }, 10_000);

    // Fallback logic after a short delay, giving Supabase _initialize() time
    const fallbackTimer = setTimeout(async () => {
      if (handledRef.current) return;

      try {
        // Check for error in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const errorDesc = urlParams.get('error_description');
        if (errorDesc) {
          setError(errorDesc);
          return;
        }

        // PKCE flow: ?code= parameter
        const code = urlParams.get('code');
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (data.session) {
            goHome();
            return;
          }
        }

        // Implicit flow: #access_token= in hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          if (data.session) {
            goHome();
            return;
          }
        }

        // Last resort: check if a session already exists
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          goHome();
        }
        // If no session and no error, the timeout UI will handle it
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Something went wrong');
      }
    }, 1_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
      clearTimeout(fallbackTimer);
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-boon-bg flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-boon-text mb-3">Sign in failed</h1>
            <p className="text-gray-500 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3 bg-boon-blue text-white rounded-2xl font-bold text-sm hover:bg-boon-darkBlue transition-all"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boon-bg flex items-center justify-center p-6">
      <div className="text-center">
        <img
          src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Icon_Blue_10_i8hkao.png"
          className="w-12 h-12 animate-bounce mx-auto mb-4"
          alt="Loading..."
        />
        <p className="text-boon-blue font-medium">Signing you in...</p>
        {timedOut && (
          <div className="mt-6 space-y-3">
            <p className="text-amber-600 text-sm">This is taking longer than expected.</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-white text-boon-blue border border-boon-blue rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
