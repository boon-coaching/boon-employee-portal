import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Coach, Employee, Session } from '../lib/types';
import { fetchCoachById, fetchCoachByName, fetchCoachBySfId } from '../lib/dataFetcher';
import { coachAvatarObjectPosition, optimizeCoachPhoto } from '../lib/coachPhoto';

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

function coachFirstNameOf(coach: Coach | null, session: Session | null): string {
  const name = coach?.name?.trim() || session?.coach_name?.trim();
  if (!name) return 'your coach';
  return name.split(' ')[0];
}

// Decode HTML entities like &amp; that come through from rich-text fields.
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Truncate a string to ~N chars at the nearest sentence boundary, otherwise word.
function truncate(text: string | null, maxLength = 140): string | null {
  if (!text) return null;
  const trimmed = decodeEntities(text.trim());
  if (trimmed.length <= maxLength) return trimmed;
  const slice = trimmed.slice(0, maxLength);
  const lastPeriod = slice.lastIndexOf('.');
  if (lastPeriod > maxLength * 0.5) return trimmed.slice(0, lastPeriod + 1);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? trimmed.slice(0, lastSpace) : slice) + '…';
}

// Pick the first sub-theme from a semicolon-joined string ("A;B;C" → "A").
function firstTheme(text: string | null): string | null {
  if (!text) return null;
  const first = text.split(/[;|]/)[0]?.trim();
  return first || null;
}

// Pull the most concrete "what we were working on" signal from the last session.
function lastFocus(session: Session | null): string | null {
  if (!session) return null;
  const themes = [
    firstTheme(session.leadership_management_skills),
    firstTheme(session.communication_skills),
    firstTheme(session.mental_well_being),
    firstTheme(session.other_themes),
  ].filter((t): t is string => !!t && t.length > 0);
  if (themes.length > 0) return truncate(themes[0], 120);
  return truncate(session.goals, 160);
}

// Detect generic meeting-title summaries that aren't real recap content.
function isUsefulSummary(text: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 60) return false; // too short to be a real recap
  if (/coaching session/i.test(t) && t.length < 120) return false; // looks like a title
  if (/^[A-Z][a-z]+\s*<>\s*[A-Z]/.test(t)) return false; // "Bobby <> Notae ..."
  return true;
}

export default function InactiveHome({ profile, lastSession, daysSinceLastSession }: InactiveHomeProps) {
  const navigate = useNavigate();
  const [coach, setCoach] = useState<Coach | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCoach() {
      let result: Coach | null = null;
      if (profile?.coach) result = await fetchCoachBySfId(profile.coach);
      if (!result && profile?.coach_id) result = await fetchCoachById(profile.coach_id);
      if (!result && lastSession?.coach_name) result = await fetchCoachByName(lastSession.coach_name);
      if (!cancelled) setCoach(result);
    }
    loadCoach();
    return () => { cancelled = true; };
  }, [profile?.coach, profile?.coach_id, lastSession?.coach_name]);

  const coachFirstName = coachFirstNameOf(coach, lastSession);
  const gap = formatGap(daysSinceLastSession);
  const lastDate = lastSession
    ? new Date(lastSession.session_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const focus = lastFocus(lastSession);
  const initials = (coach?.name || lastSession?.coach_name || 'YC')
    .split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32 md:pb-0">
      <header className="text-center pt-2">
        <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
          Hi {profile?.first_name || 'there'}
        </h1>
        <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
          {gap} since your last session
        </p>
      </header>

      <section className="bg-boon-coral/12 rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">Where you left off</span>
        </div>

        <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-6">
          Pick it back <span className="font-serif italic font-normal">up</span>?
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
            <p className="text-boon-navy font-bold leading-tight">{coach?.name || lastSession?.coach_name || coachFirstName}</p>
            {coach?.headline && (
              <p className="text-boon-charcoal/60 text-sm leading-tight">{truncate(coach.headline, 80)}</p>
            )}
          </div>
        </div>

        <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-6">
          You and {coachFirstName} last met
          {lastDate ? ` on ${lastDate}` : ''}.
          {focus
            ? <> You were working on <span className="font-serif italic">{focus.replace(/\.$/, '')}</span>.</>
            : <> Whenever you're ready, the conversation picks up where it left off.</>
          }
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

      {/* Last session preview — fills the canvas with concrete recall */}
      {lastSession && isUsefulSummary(lastSession.summary) && (
        <section className="bg-white rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08] shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">From your last session</span>
            {lastDate && <span className="text-boon-charcoal/45 text-xs">· {lastDate}</span>}
          </div>
          <p className="text-boon-navy/85 text-base md:text-lg leading-relaxed font-serif italic">
            "{truncate(lastSession.summary, 320)}"
          </p>
          <button
            onClick={() => navigate('/sessions')}
            className="mt-4 text-boon-blue font-bold text-sm hover:underline inline-flex items-center gap-1"
          >
            See the full notes
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        <button
          onClick={() => navigate('/sessions')}
          className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all"
        >
          <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Revisit your last session</p>
          <p className="text-boon-charcoal/75 text-sm">See what you were working on with {coachFirstName}.</p>
        </button>
        <button
          onClick={() => navigate('/practice')}
          className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-purple/30 hover:shadow-md transition-all"
        >
          <p className="text-[11px] font-extrabold text-boon-purple uppercase tracking-[0.18em] mb-2">Practice space</p>
          <p className="text-boon-charcoal/75 text-sm">Run through scenarios while you decide.</p>
        </button>
      </div>
    </div>
  );
}
