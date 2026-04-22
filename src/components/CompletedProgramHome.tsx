import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalData } from './ProtectedLayout';
import GrowthStory from './GrowthStory';
import KeyTakeaways from './KeyTakeaways';
import CompletionAcknowledgment from './CompletionAcknowledgment';

export function CompletedProgramHome() {
  const navigate = useNavigate();
  const data = usePortalData();
  const { employee: profile, effectiveSessions: sessions, effectiveActionItems: actionItems, effectiveBaseline: baseline, programType, competencyScores } = data;
  const userEmail = profile?.company_email || '';

  const [showCompletionAck, setShowCompletionAck] = useState(true);
  const completedSessions = sessions.filter(s => s.status === 'Completed');
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

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

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in">

      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-2">
        <div className="text-center sm:text-left">
          <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
            Hi {profile?.first_name || 'there'}
          </h1>
          <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
            Your leadership journey with Boon
          </p>
        </div>
      </header>

      {/* Program Summary */}
      <section className="bg-white rounded-card p-7 md:p-10 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-boon-charcoal/[0.08]">
        <h2 className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-8">
          Program Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <p className="text-lg font-black text-boon-navy tracking-tight truncate">
              {lastSession?.coach_name?.split(' ')[0] || '\u2014'}
            </p>
            <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Coach</p>
          </div>
          <div>
            <p className="text-lg font-black text-boon-blue tracking-tight">{programType || 'Boon'}</p>
            <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Program</p>
          </div>
          <div>
            <p className="text-lg font-black text-boon-success tracking-tight">
              {completedSessions.length}
            </p>
            <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Total Sessions</p>
          </div>
          <div>
            <p className="text-lg font-black text-boon-navy tracking-tight">
              {(() => {
                const first = completedSessions[completedSessions.length - 1];
                const last = completedSessions[0];
                if (!first || !last) return '\u2014';
                const startDate = new Date(first.session_date);
                const endDate = new Date(last.session_date);
                const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
                const endMonth = endDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                return `${startMonth} \u2013 ${endMonth}`;
              })()}
            </p>
            <p className="text-[10px] text-boon-charcoal/55 uppercase tracking-widest">Duration</p>
          </div>
        </div>
      </section>

      {/* Growth Story */}
      <GrowthStory
        sessions={sessions}
        competencyScores={competencyScores}
        baseline={baseline}
      />

      {/* Your Goals - from most recent session */}
      {lastSession?.goals && (
        <section className="bg-gradient-to-br from-boon-blue/5 to-boon-lightBlue/20 rounded-card p-8 border border-boon-blue/10">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-extrabold text-boon-navy">
              Your Leadership Goals
            </h2>
            <span className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest">
              From {new Date(lastSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="prose prose-sm max-w-none">
            <div className="text-boon-charcoal/75 leading-relaxed whitespace-pre-line">
              {lastSession.goals}
            </div>
          </div>
        </section>
      )}

      {/* Areas of Growth */}
      {focusAreas.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-xl font-extrabold text-boon-navy">
            Areas of Growth
          </h2>
          <div className="space-y-3">
            {focusAreas.map((area, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-card border border-boon-charcoal/[0.08] shadow-sm hover:border-boon-blue/20 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <h3 className="font-bold text-boon-navy group-hover:text-boon-blue transition-colors leading-snug">
                  {area!.label}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-wider">
                    {area!.count} {area!.count === 1 ? 'session' : 'sessions'}
                  </span>
                  <span className="text-gray-200">&bull;</span>
                  <span className="text-[11px] font-medium text-boon-charcoal/55">
                    Explored {new Date(area!.firstDiscussed).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key Takeaways for completed */}
      <KeyTakeaways actionItems={actionItems} sessions={sessions} />

      {/* What's Next */}
      <div className="space-y-8 pb-8">
        <section className="bg-boon-offWhite rounded-card p-8 border border-boon-charcoal/[0.08]">
          <p className="text-boon-charcoal/55 text-sm mb-4">
            When hard moments come up, your practice space is still here.
          </p>
          <button
            onClick={() => navigate('/practice')}
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            Practice a scenario
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </section>

        <div className="grid md:grid-cols-2 gap-8">
          <section className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm">
            <div className="flex flex-col h-full justify-between">
              <div>
                <p className="text-[11px] font-black text-boon-success uppercase tracking-[0.18em] mb-2">
                  Leadership Profile
                </p>
                <p className="text-boon-charcoal/75 text-sm leading-relaxed">
                  See your complete competency profile and how you grew through your program.
                </p>
              </div>
              <button
                onClick={() => navigate('/progress')}
                className="mt-6 text-sm font-black text-boon-blue hover:underline uppercase tracking-widest text-left"
              >
                View Profile &rarr;
              </button>
            </div>
          </section>

          <section className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm">
            <div className="flex flex-col h-full justify-between">
              <div>
                <p className="text-[11px] font-black text-boon-purple uppercase tracking-[0.18em] mb-2">
                  Session Archive
                </p>
                <p className="text-boon-charcoal/75 text-sm leading-relaxed">
                  Revisit your complete coaching history and session notes.
                </p>
              </div>
              <button
                onClick={() => navigate('/sessions')}
                className="mt-6 text-sm font-black text-boon-blue hover:underline uppercase tracking-widest text-left"
              >
                View Sessions &rarr;
              </button>
            </div>
          </section>
        </div>

        {programType !== 'SCALE' && (
          <section className="text-center py-4">
            <p className="text-boon-charcoal/55 text-sm">
              Some people continue with ongoing 1:1 coaching.{' '}
              <a
                href="mailto:hello@boon-health.com?subject=Interest%20in%20SCALE%20Program"
                className="text-boon-charcoal/55 hover:text-boon-blue underline underline-offset-2"
              >
                Learn about SCALE &rarr;
              </a>
            </p>
          </section>
        )}
      </div>

      {/* Completion Acknowledgment Modal */}
      {showCompletionAck && lastSession && (
        <CompletionAcknowledgment
          sessions={sessions}
          coachName={lastSession.coach_name}
          userEmail={userEmail}
          programType={programType}
          onDismiss={() => setShowCompletionAck(false)}
        />
      )}
    </div>
  );
}
