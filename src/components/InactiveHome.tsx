import { useNavigate } from 'react-router-dom';
import type { Employee, Session } from '../lib/types';

interface InactiveHomeProps {
  profile: Employee | null;
  lastSession: Session | null;
  daysSinceLastSession: number;
}

function formatGap(days: number): string {
  if (days < 60) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 13) return `${weeks} weeks`;
  const months = Math.round(days / 30);
  return `${months} months`;
}

function coachFirstNameOf(session: Session | null): string {
  const name = session?.coach_name?.trim();
  if (!name) return 'your coach';
  return name.split(' ')[0];
}

export default function InactiveHome({ profile, lastSession, daysSinceLastSession }: InactiveHomeProps) {
  const navigate = useNavigate();
  const coachFirstName = coachFirstNameOf(lastSession);
  const gap = formatGap(daysSinceLastSession);
  const lastDate = lastSession
    ? new Date(lastSession.session_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in">
      <header className="text-center pt-2">
        <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
          Hi {profile?.first_name || 'there'}
        </h1>
        <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
          It's been a minute
        </p>
      </header>

      <section className="bg-boon-coral/12 rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M12 7v5l3 2" />
            </svg>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">Where You Left Off</span>
        </div>

        <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-2xl md:text-3xl mb-4">
          Pick it back up?
        </h2>

        <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-6">
          {gap} since you and {coachFirstName} last met
          {lastDate ? ` on ${lastDate}` : ''}.
          {' '}Whenever you're ready, the conversation picks up where it left off.
        </p>

        {profile?.booking_link ? (
          <a
            href={profile.booking_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-boon-blue rounded-btn hover:bg-boon-navy transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Book a session with {coachFirstName}
          </a>
        ) : (
          <a
            href="mailto:hello@boon-health.com?subject=Restart%20My%20Coaching"
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            Reach out to restart
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        <button
          onClick={() => navigate('/sessions')}
          className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/20 transition-all"
        >
          <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Revisit Your Last Session</p>
          <p className="text-boon-charcoal/75 text-sm">See what you were working on with {coachFirstName}.</p>
        </button>
        <button
          onClick={() => navigate('/practice')}
          className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/20 transition-all"
        >
          <p className="text-[11px] font-extrabold text-boon-purple uppercase tracking-[0.18em] mb-2">Practice Space</p>
          <p className="text-boon-charcoal/75 text-sm">Run through scenarios while you decide.</p>
        </button>
      </div>
    </div>
  );
}
