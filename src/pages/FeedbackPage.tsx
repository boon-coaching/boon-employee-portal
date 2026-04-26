import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { SurveyType } from '../lib/types';
import { fetchSurveyContext } from '../lib/dataFetcher';
import SurveyModal from '../components/SurveyModal';
import { useAuth } from '../lib/AuthContext';

/**
 * Feedback Page
 *
 * Routes:
 * - /feedback?session_id=xxx - Survey for a specific session
 * - /feedback?type=grow_baseline - Direct link for baseline survey
 * - /feedback?type=grow_end - Direct link for end-of-program survey
 */
export default function FeedbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Survey context
  const [surveyType, setSurveyType] = useState<SurveyType | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [coachName, setCoachName] = useState<string>('Your Coach');

  useEffect(() => {
    const loadSurveyContext = async () => {
      if (!user?.email) {
        setError('Please log in to provide feedback');
        setIsLoading(false);
        return;
      }

      const sessionIdParam = searchParams.get('session_id');
      const typeParam = searchParams.get('type') as SurveyType | null;

      // Direct type link (for GROW surveys)
      if (typeParam && ['grow_baseline', 'grow_end'].includes(typeParam)) {
        setSurveyType(typeParam);
        setIsLoading(false);
        return;
      }

      // Session-based survey
      if (sessionIdParam) {
        try {
          const context = await fetchSurveyContext(sessionIdParam);

          if (!context) {
            setError('Session not found');
            setIsLoading(false);
            return;
          }

          // Verify the session belongs to this user
          if (context.employee_email.toLowerCase() !== user.email.toLowerCase()) {
            setError('This survey is not associated with your account');
            setIsLoading(false);
            return;
          }

          setSessionId(context.session_id);
          setSessionNumber(context.session_number);
          setCoachName(context.coach_name);

          // Determine survey type based on context
          // For now, default to feedback
          // Could check if it's the final session for end_of_program
          setSurveyType('feedback');
          setIsLoading(false);
        } catch (err) {
          setError('Failed to load survey context');
          setIsLoading(false);
        }
        return;
      }

      // No valid params
      setError('Invalid feedback link');
      setIsLoading(false);
    };

    loadSurveyContext();
  }, [searchParams, user]);

  const handleComplete = () => {
    // Redirect to dashboard with success message
    navigate('/?feedback=submitted');
  };

  const handleClose = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-boon-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-boon-blue/30 border-t-boon-blue rounded-pill animate-spin mx-auto mb-4" />
          <p className="text-boon-charcoal/55 text-sm">Loading survey</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-boon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-card shadow-sm border border-boon-charcoal/[0.08] p-8 md:p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">Survey unavailable</span>
          </div>
          <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-2xl md:text-3xl mb-3">
            Couldn't load <span className="font-serif italic font-normal">this one</span>.
          </h2>
          <p className="text-boon-charcoal/75 leading-relaxed mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-boon-blue rounded-btn hover:bg-boon-navy transition-all shadow-sm"
          >
            Back to home
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (!surveyType || !user?.email) {
    return null;
  }

  return (
    <div className="min-h-screen bg-boon-bg">
      <SurveyModal
        isOpen={true}
        surveyType={surveyType}
        sessionId={sessionId || undefined}
        sessionNumber={sessionNumber || undefined}
        coachName={coachName}
        userEmail={user.email}
        onComplete={handleComplete}
        onClose={handleClose}
      />
    </div>
  );
}
