import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Coach, Employee, Session, BaselineSurvey, ProgramType } from '../lib/types';
import { fetchCoachByName } from '../lib/dataFetcher';
import { coachAvatarObjectPosition } from '../lib/coachPhoto';

interface PendingReflectionHomeProps {
  profile: Employee | null;
  sessions: Session[];
  baseline: BaselineSurvey | null;
  programType: ProgramType | null;
  onStartReflection: () => void;
}

export default function PendingReflectionHome({
  profile,
  sessions,
  baseline,
  programType,
  onStartReflection,
}: PendingReflectionHomeProps) {
  const navigate = useNavigate();
  const completedSessions = sessions.filter(s => s.status === 'Completed');
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;
  const coachName = lastSession?.coach_name || null;
  const coachFirstName = coachName ? coachName.split(' ')[0] : 'your coach';
  const coachInitials = (coachName || 'YC')
    .split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const [coach, setCoach] = useState<Coach | null>(null);
  useEffect(() => {
    if (coachName) {
      fetchCoachByName(coachName).then((c) => setCoach(c as Coach | null));
    }
  }, [coachName]);

  const firstSession = completedSessions.length > 0 ? completedSessions[completedSessions.length - 1] : null;
  const startDate = firstSession ? new Date(firstSession.session_date) : null;
  const endDate = lastSession ? new Date(lastSession.session_date) : null;
  const durationStr = startDate && endDate
    ? `${startDate.toLocaleDateString('en-US', { month: 'short' })} to ${endDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`
    : null;

  const programDisplayName = programType === 'EXEC' ? 'Executive Coaching' : programType || 'coaching';
  const hasBaseline = !!baseline;

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32 md:pb-0">
      <header className="text-center pt-2">
        <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
          Hi {profile?.first_name || 'there'}
        </h1>
        <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
          Your {programDisplayName} program is complete
        </p>
      </header>

      <section className="bg-boon-coral/12 rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">One last step</span>
        </div>

        <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-4">
          Close the loop on your <span className="font-serif italic font-normal">growth</span>.
        </h2>
        <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-8">
          One short reflection unlocks your full Leadership Profile. You'll see how you've grown across 12 competencies, baseline to now.
        </p>

        <button
          onClick={onStartReflection}
          className="inline-flex items-center gap-3 px-6 py-3 text-sm font-bold rounded-btn text-white bg-boon-blue hover:bg-boon-navy transition-all shadow-sm"
        >
          Start reflection
          <span className="text-xs font-medium text-white/85">~3 min</span>
        </button>
      </section>

      <section className="bg-white rounded-card p-7 md:p-10 shadow-sm border border-boon-charcoal/[0.08]">
        <h2 className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-8">
          Program summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-center gap-3">
            {coach?.photo_url ? (
              <img
                src={coach.photo_url}
                alt={coachName || 'Coach'}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-boon-coral/40"
                style={{ objectPosition: coachAvatarObjectPosition(coach.photo_url) }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-boon-blue/15 ring-2 ring-boon-coral/40 flex items-center justify-center text-boon-blue font-bold text-sm">
                {coachInitials}
              </div>
            )}
            <div>
              <p className="text-lg font-black text-boon-navy tracking-tight truncate">
                {coachFirstName}
              </p>
              <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Coach</p>
            </div>
          </div>

          <div>
            <p className="text-lg font-black text-boon-blue tracking-tight">{programType || 'Boon'}</p>
            <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Program</p>
          </div>

          <div>
            <p className="text-lg font-black text-boon-success tracking-tight">
              {completedSessions.length}
            </p>
            <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Total sessions</p>
          </div>

          {durationStr && (
            <div>
              <p className="text-lg font-black text-boon-navy tracking-tight">{durationStr}</p>
              <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Duration</p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-boon-offWhite rounded-card p-8 border border-boon-charcoal/[0.08]">
        <h3 className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-6">
          What you'll see after the reflection
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-btn bg-boon-blue/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-boon-charcoal/75 font-medium">Your growth across 12 leadership competencies</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-btn bg-boon-coral/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-boon-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-boon-charcoal/75 font-medium">How you compare to where you started</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-btn bg-boon-blue/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <p className="text-boon-charcoal/75 font-medium">Your complete Leadership Profile</p>
          </div>
        </div>

        {hasBaseline && (
          <div className="mt-6 pt-6 border-t border-boon-charcoal/[0.08]">
            <p className="text-sm text-boon-charcoal/55 italic">
              Your baseline is ready. Complete the reflection to see your final scores.
            </p>
          </div>
        )}
      </section>

      {lastSession?.goals && (
        <section className="bg-white rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08] shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em]">From your last session</h2>
            <span className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest">
              {new Date(lastSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="prose prose-sm max-w-none">
            <div className="text-boon-charcoal/75 leading-relaxed whitespace-pre-line">
              {lastSession.goals}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-5">
        <h2 className="text-xl font-extrabold text-boon-navy">Areas of growth</h2>
        <div className="space-y-3">
          {(() => {
            const themes = [
              { key: 'leadership_management_skills', label: 'Leading with empathy and clarity' },
              { key: 'communication_skills', label: 'Communicating with impact and intention' },
              { key: 'mental_well_being', label: 'Cultivating sustainable mental energy' },
            ];

            const focusAreas = themes.map(theme => {
              const sessionsWithTheme = completedSessions.filter(s => (s as any)[theme.key]);
              if (sessionsWithTheme.length === 0) return null;
              const firstDiscussed = sessionsWithTheme.reduce((earliest, current) => {
                return new Date(current.session_date) < new Date(earliest) ? current.session_date : earliest;
              }, sessionsWithTheme[0].session_date);
              return { label: theme.label, firstDiscussed, count: sessionsWithTheme.length };
            }).filter(Boolean);

            return focusAreas.length > 0 ? focusAreas.map((area, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-card border border-boon-charcoal/[0.08] shadow-sm"
              >
                <h3 className="font-bold text-boon-navy leading-snug">
                  {area!.label}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-wider">
                    {area!.count} {area!.count === 1 ? 'session' : 'sessions'}
                  </span>
                  <span className="text-boon-charcoal/20">·</span>
                  <span className="text-[11px] font-medium text-boon-charcoal/55">
                    Explored {new Date(area!.firstDiscussed).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-boon-charcoal/55 italic text-sm">Themes from your sessions will appear here.</p>
            );
          })()}
        </div>
      </section>

      <button
        onClick={() => navigate('/practice')}
        className="w-full bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all group"
      >
        <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Practice space</p>
        <p className="text-boon-navy text-lg font-bold mb-1">When hard moments come up, this is still here.</p>
        <p className="text-boon-charcoal/65 text-sm">AI-powered leadership scenarios. Real practice, real feedback.</p>
        <span className="inline-flex items-center gap-1 mt-4 text-boon-blue text-sm font-bold group-hover:underline">
          Run a scenario
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>

      <div className="text-center">
        <button
          onClick={onStartReflection}
          className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
        >
          Complete your reflection to unlock your Leadership Profile
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
