import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Coach, Employee } from '../lib/types';
import { fetchCoachById, fetchCoachByEmail, fetchCoachBySfId } from '../lib/dataFetcher';
import { coachAvatarObjectPosition, optimizeCoachPhoto } from '../lib/coachPhoto';

interface DroppedFirstHomeProps {
  profile: Employee | null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function truncate(text: string | null, max = 90): string {
  if (!text) return '';
  const trimmed = decodeEntities(text.trim());
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trim() + '…';
}

export default function DroppedFirstHome({ profile }: DroppedFirstHomeProps) {
  const navigate = useNavigate();
  const [coach, setCoach] = useState<Coach | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let result: Coach | null = null;
      // The selected coach is stored across two distinct columns:
      //   employee_manager.coach_id = internal UUID (newer pipeline)
      //   employee_manager.coach    = SF Contact Id (mirror of SF Coach__c)
      // Try the SF id first since it's the freshest signal post-sync (PR #163),
      // then internal UUID, then fall back to the match-candidate emails on
      // the off chance the selected coach was Coach 1 or Coach 2.
      if (profile?.coach) result = await fetchCoachBySfId(profile.coach);
      if (!result && profile?.coach_id) result = await fetchCoachById(profile.coach_id);
      if (!result && profile?.sf_coach_1_email) result = await fetchCoachByEmail(profile.sf_coach_1_email);
      if (!result && profile?.sf_coach_2_email) result = await fetchCoachByEmail(profile.sf_coach_2_email);
      if (!cancelled) setCoach(result);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile?.coach, profile?.coach_id, profile?.sf_coach_1_email, profile?.sf_coach_2_email]);

  const coachName = coach?.name?.trim() || '';
  const coachFirstName = coachName ? coachName.split(' ')[0] : 'your coach';
  const initials = (coachName || 'YC')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32 md:pb-0">
      <header className="text-center pt-2">
        <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
          Hi {profile?.first_name || 'there'}
        </h1>
        <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
          You haven't actually met yet
        </p>
      </header>

      <section className="bg-boon-coral/12 rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7m6-7H3"
              />
            </svg>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">
            Restart
          </span>
        </div>

        <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-6">
          Give it another <span className="font-serif italic font-normal">go</span>?
        </h2>

        <div className="flex items-center gap-4 mb-5">
          {coach?.photo_url ? (
            <img
              src={optimizeCoachPhoto(coach.photo_url, 56) || ''}
              alt={coach.name}
              loading="lazy"
              decoding="async"
              className="w-14 h-14 rounded-full object-cover ring-2 ring-boon-coral/40"
              style={{ objectPosition: coachAvatarObjectPosition(coach.photo_url) }}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-boon-blue/15 ring-2 ring-boon-coral/40 flex items-center justify-center text-boon-blue font-bold">
              {initials}
            </div>
          )}
          <div>
            <p className="text-boon-navy font-bold leading-tight">
              {coach?.name || coachFirstName}
            </p>
            {coach?.headline && (
              <p className="text-boon-charcoal/60 text-sm leading-tight">
                {truncate(coach.headline, 80)}
              </p>
            )}
          </div>
        </div>

        <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-6">
          You and {coachFirstName} were matched but haven't connected yet. Schedules slip. Life
          happens. Book a time when you can show up and the conversation starts.
        </p>

        {profile?.booking_link ? (
          <a
            href={profile.booking_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-boon-blue rounded-btn hover:bg-boon-navy transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Book a session with {coachFirstName}
          </a>
        ) : (
          <a
            href="mailto:hello@boon-health.com?subject=Restart%20My%20Coaching"
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            Reach out to schedule
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}
      </section>

      <section className="bg-white rounded-card p-7 md:p-8 border border-boon-charcoal/[0.08] shadow-sm">
        <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">
          Want different options?
        </p>
        <p className="text-boon-charcoal/75 text-sm mb-5">
          If {coachFirstName} doesn't feel like the right fit, we can match you with someone else.
        </p>
        <a
          href="mailto:hello@boon-health.com?subject=New%20Coach%20Match"
          className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
        >
          Request a different coach
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </section>

      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        <button
          onClick={() => navigate('/practice')}
          className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-purple/30 hover:shadow-md transition-all"
        >
          <p className="text-[11px] font-extrabold text-boon-purple uppercase tracking-[0.18em] mb-2">
            Practice space
          </p>
          <p className="text-boon-charcoal/75 text-sm">
            Run through scenarios while you decide.
          </p>
        </button>
        <a
          href="https://boon-health.com/about"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all"
        >
          <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">
            How coaching works
          </p>
          <p className="text-boon-charcoal/75 text-sm">
            What to expect in your first session.
          </p>
        </a>
      </div>
    </div>
  );
}
