import { useAuth } from '../lib/AuthContext';

interface WelcomePageProps {
  welcomeSurveyUrl?: string;
}

export default function WelcomePage({ welcomeSurveyUrl }: WelcomePageProps) {
  const { employee, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-boon-bg">
      <header className="p-6">
        <img
          src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863862/Logo_Blue_2_kl7tot.png"
          alt="Boon"
          className="h-8"
        />
      </header>

      <main className="flex items-center justify-center px-6 py-12 pb-32 md:pb-12">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="bg-white rounded-card p-8 md:p-10 shadow-sm border border-boon-charcoal/[0.08]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">First step</span>
            </div>

            <h1 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-4">
              Welcome{employee?.first_name ? `, ${employee.first_name}` : ''}.{' '}
              <span className="font-serif italic font-normal">Let's begin.</span>
            </h1>
            <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-8">
              A short survey tells us where you want to grow. Your answers go straight to the coach we hand-pick for you, so the first conversation already has shape.
            </p>

            <div className="bg-boon-offWhite rounded-card p-6 mb-8 border border-boon-charcoal/[0.08]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55 mb-4">What comes next</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-boon-coral mt-0.5 flex-shrink-0" aria-hidden>•</span>
                  <span className="text-boon-charcoal/75 text-sm">A coach matched to your goals, style, and the work you actually want to do</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-boon-coral mt-0.5 flex-shrink-0" aria-hidden>•</span>
                  <span className="text-boon-charcoal/75 text-sm">1:1 sessions paced to your calendar</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-boon-coral mt-0.5 flex-shrink-0" aria-hidden>•</span>
                  <span className="text-boon-charcoal/75 text-sm">A practice space and journal between sessions</span>
                </li>
              </ul>
            </div>

            {welcomeSurveyUrl ? (
              <a
                href={welcomeSurveyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-3 px-6 py-3 text-sm font-bold rounded-btn text-white bg-boon-blue hover:bg-boon-navy transition-all shadow-sm"
              >
                Start welcome survey
                <span className="text-xs font-medium text-white/85">~5 min</span>
              </a>
            ) : (
              <div className="w-full py-3 bg-boon-charcoal/10 text-boon-charcoal/45 rounded-btn font-bold text-sm text-center cursor-not-allowed">
                Start welcome survey
              </div>
            )}
            <p className="text-xs text-boon-charcoal/55 mt-4 text-center">
              {welcomeSurveyUrl
                ? 'Takes about 5 minutes.'
                : <>Your survey is being prepared. <a href="mailto:hello@boon-health.com" className="text-boon-blue hover:underline">Reach out</a> if you want a nudge.</>
              }
            </p>
          </div>

          <p className="text-center text-sm text-boon-charcoal/55 mt-8">
            Signed in as {employee?.company_email || 'unknown'}.{' '}
            <button onClick={signOut} className="text-boon-blue hover:underline">
              Sign out
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
