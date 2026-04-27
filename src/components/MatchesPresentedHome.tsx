import { useEffect, useState } from 'react';
import type { Coach, Employee } from '../lib/types';
import { fetchCoachByEmail } from '../lib/dataFetcher';
import { coachAvatarObjectPosition, optimizeCoachPhoto } from '../lib/coachPhoto';

interface MatchesPresentedHomeProps {
  profile: Employee | null;
  matchesAreStale: boolean;
  daysSinceMatchEmailSent: number | null;
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

function truncate(text: string | null, maxLength = 90): string {
  if (!text) return '';
  const trimmed = decodeEntities(text.trim());
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trim() + '…';
}

interface CoachCardProps {
  coach: Coach | null;
  bookingLink: string | null;
  loading: boolean;
}

function CoachCardSkeleton() {
  return (
    <div className="bg-white rounded-card p-7 md:p-8 border border-boon-charcoal/[0.08] shadow-sm flex flex-col animate-pulse">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full bg-boon-charcoal/[0.08]" />
        <div className="min-w-0 flex-1">
          <div className="h-5 bg-boon-charcoal/[0.08] rounded w-32 mb-2" />
          <div className="h-3 bg-boon-charcoal/[0.05] rounded w-48" />
        </div>
      </div>
      <div className="space-y-2 mb-6 flex-1">
        <div className="h-3 bg-boon-charcoal/[0.05] rounded w-full" />
        <div className="h-3 bg-boon-charcoal/[0.05] rounded w-11/12" />
        <div className="h-3 bg-boon-charcoal/[0.05] rounded w-3/4" />
      </div>
      <div className="h-11 bg-boon-charcoal/[0.05] rounded-btn" />
    </div>
  );
}

function CoachCard({ coach, bookingLink, loading }: CoachCardProps) {
  if (loading) return <CoachCardSkeleton />;

  const displayName = coach?.name || 'Your coach';
  const firstName = coach?.name ? coach.name.split(' ')[0] : 'this coach';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="bg-white rounded-card p-7 md:p-8 border border-boon-charcoal/[0.08] shadow-sm hover:border-boon-blue/30 hover:shadow-md transition-all flex flex-col">
      <div className="flex items-center gap-4 mb-5">
        {coach?.photo_url ? (
          <img
            src={optimizeCoachPhoto(coach.photo_url, 64) || ''}
            alt={coach.name}
            loading="lazy"
            decoding="async"
            className="w-16 h-16 rounded-full object-cover ring-2 ring-boon-coral/40"
            style={{ objectPosition: coachAvatarObjectPosition(coach.photo_url) }}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-boon-blue/15 ring-2 ring-boon-coral/40 flex items-center justify-center text-boon-blue font-bold text-lg">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display font-bold text-boon-navy text-lg leading-tight truncate">
            {displayName}
          </p>
          {coach?.headline && (
            <p className="text-boon-charcoal/60 text-sm leading-tight">
              {truncate(coach.headline, 80)}
            </p>
          )}
        </div>
      </div>

      {coach?.bio && (
        <p className="text-boon-charcoal/75 text-sm leading-relaxed mb-6 flex-1">
          {truncate(coach.bio, 220)}
        </p>
      )}

      {bookingLink ? (
        <a
          href={bookingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-boon-blue rounded-btn hover:bg-boon-navy transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Book with {firstName}
        </a>
      ) : (
        <span className="text-boon-charcoal/55 text-sm italic">Booking link unavailable</span>
      )}
    </div>
  );
}

export default function MatchesPresentedHome({
  profile,
  matchesAreStale,
  daysSinceMatchEmailSent,
}: MatchesPresentedHomeProps) {
  const [coach1, setCoach1] = useState<Coach | null>(null);
  const [coach2, setCoach2] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [c1, c2] = await Promise.all([
        profile?.sf_coach_1_email ? fetchCoachByEmail(profile.sf_coach_1_email) : Promise.resolve(null),
        profile?.sf_coach_2_email ? fetchCoachByEmail(profile.sf_coach_2_email) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setCoach1(c1);
        setCoach2(c2);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile?.sf_coach_1_email, profile?.sf_coach_2_email]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32 md:pb-0">
      <header className="text-center pt-2">
        <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
          Hi {profile?.first_name || 'there'}
        </h1>
        <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
          {matchesAreStale
            ? `It's been ${daysSinceMatchEmailSent} days. Let's get you moving.`
            : 'Your matches are ready'}
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">
            {matchesAreStale ? 'Still picking?' : 'Pick your coach'}
          </span>
        </div>

        <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-4">
          {matchesAreStale ? (
            <>
              Two paths <span className="font-serif italic font-normal">forward</span>.
            </>
          ) : (
            <>
              Pick the coach who feels <span className="font-serif italic font-normal">right</span>.
            </>
          )}
        </h2>

        <p className="text-boon-charcoal/75 text-lg leading-relaxed">
          {matchesAreStale
            ? 'Coach availability shifts over time. The two we matched you with may still be available, or we can refresh your options.'
            : 'We picked these two based on your goals, preferences, and style. Book with either to get started.'}
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        <CoachCard
          coach={coach1}
          bookingLink={profile?.sf_coach_1_booking_link || null}
          loading={loading}
        />
        <CoachCard
          coach={coach2}
          bookingLink={profile?.sf_coach_2_booking_link || null}
          loading={loading}
        />
      </div>

      {matchesAreStale && (
        <section className="bg-white rounded-card p-7 md:p-8 border border-boon-charcoal/[0.08] shadow-sm text-center">
          <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">
            Want fresh options?
          </p>
          <p className="text-boon-charcoal/75 text-sm mb-5">
            We can match you with new coaches based on your latest goals and current availability.
          </p>
          <a
            href="mailto:hello@boon-health.com?subject=Fresh%20Coach%20Matches"
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            Request new matches
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </section>
      )}
    </div>
  );
}
