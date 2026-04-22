import { useState, useEffect, type ReactNode } from 'react';
import { Card, Headline, Button, Avatar, Badge } from '../lib/design-system';
import type { Coach } from '../lib/types';
import { fetchCoachByName, parseCoachSpecialties, fetchMatchSummary } from '../lib/dataFetcher';
import { usePortalData } from './ProtectedLayout';

type EyebrowColor = 'blue' | 'coral' | 'muted' | 'charcoal' | 'white';
const EYEBROW_COLORS: Record<EyebrowColor, string> = {
  blue: 'text-boon-blue',
  coral: 'text-boon-coral',
  muted: 'text-boon-charcoal/55',
  charcoal: 'text-boon-charcoal',
  white: 'text-white/80',
};
function Eyebrow({
  color = 'charcoal',
  className = '',
  children,
}: {
  color?: EyebrowColor;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${EYEBROW_COLORS[color]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Extract the specific coach's summary from the full match_summary text.
 */
function extractCoachSummary(matchSummary: string | null, coachName: string): string | null {
  if (!matchSummary || !coachName) return null;

  const nameParts = coachName.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  const coachPattern = new RegExp(
    `Coach\\s*\\d*:?\\s*${firstName}(?:\\s+\\w+)*\\s*[-–—]\\s*([^]*?)(?=Coach\\s*\\d|$)`,
    'i'
  );

  const match = matchSummary.match(coachPattern);
  if (match) {
    const fullMatch = match[0].trim();
    const dashIndex = fullMatch.search(/[-–—]/);
    if (dashIndex !== -1) {
      return fullMatch.substring(dashIndex + 1).trim();
    }
    return fullMatch;
  }

  if (lastName) {
    const lastNamePattern = new RegExp(
      `Coach\\s*\\d*:?\\s*\\w+\\s+${lastName}\\s*[-–—]\\s*([^]*?)(?=Coach\\s*\\d|$)`,
      'i'
    );
    const lastNameMatch = matchSummary.match(lastNamePattern);
    if (lastNameMatch) {
      const fullMatch = lastNameMatch[0].trim();
      const dashIndex = fullMatch.search(/[-–—]/);
      if (dashIndex !== -1) {
        return fullMatch.substring(dashIndex + 1).trim();
      }
      return fullMatch;
    }
  }

  return null;
}

function truncateBio(text: string | null, maxLength: number = 280): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastSentenceEnd = Math.max(lastPeriod, lastExclaim, lastQuestion);

  if (lastSentenceEnd > maxLength * 0.4) {
    return text.substring(0, lastSentenceEnd + 1);
  }

  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return text.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}

export default function CoachPage() {
  const portalData = usePortalData();
  const sessions = portalData.sessions;
  const coachName = sessions.length > 0 ? sessions[0].coach_name : 'Your Coach';
  const bookingLink = portalData.employee?.booking_link || null;
  const employeeId = portalData.employee?.id || null;
  const userEmail = portalData.employee?.company_email || null;
  const [coach, setCoach] = useState<Coach | null>(null);
  const [matchSummary, setMatchSummary] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  const historyWithCoach = sessions.filter(s => s.coach_name === coachName);
  const completedWithCoach = historyWithCoach.filter(s => s.status === 'Completed');
  const coachFirstName = coachName.split(' ')[0];

  useEffect(() => {
    if (coachName && coachName !== 'Your Coach') {
      fetchCoachByName(coachName).then(c => setCoach(c as Coach | null));
    }
  }, [coachName]);

  useEffect(() => {
    if (!employeeId) return;
    fetchMatchSummary(employeeId, userEmail || undefined).then(setMatchSummary);
  }, [employeeId, userEmail]);

  const specialties = coach?.special_services
    ? parseCoachSpecialties(coach.special_services, 5)
    : ['Leadership', 'EQ', 'Resilience', 'Productivity', 'Communication'];

  const coachBio = coach?.bio || `${coachFirstName} specializes in leadership development and emotional intelligence. With experience helping professionals at all levels, ${coachFirstName} helps individuals unlock their potential by balancing performance with sustainable wellbeing.`;

  const extractedSummary = extractCoachSummary(matchSummary, coachName);
  const displayMatchSummary = truncateBio(extractedSummary || coachBio, 280) || coachBio;

  const monthsTogether = completedWithCoach.length > 0
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(completedWithCoach[completedWithCoach.length - 1]?.session_date).getTime()) /
            (1000 * 60 * 60 * 24 * 30)
        )
      )
    : 0;

  const heroEyebrow = completedWithCoach.length === 0
    ? 'YOUR MATCH'
    : monthsTogether === 1
    ? 'ONE MONTH IN'
    : `${monthsTogether} MONTHS IN`;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* ─────────────── Editorial hero ─────────────── */}
      <header className="pb-6 mb-8 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <Eyebrow color="blue">Your coach</Eyebrow>
          <Eyebrow color="coral">· {heroEyebrow}</Eyebrow>
        </div>
        <Headline as="h1" size="lg">
          {coachName === 'Your Coach' ? 'Coming soon.' : `${coachFirstName}.`}{' '}
          <Headline.Kicker color="blue">
            {coachName === 'Your Coach' ? 'Match in motion.' : 'In your corner.'}
          </Headline.Kicker>
        </Headline>
      </header>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* ─────────────── Profile card ─────────────── */}
        <Card padding="lg" className="lg:col-span-5">
          <div className="flex items-start gap-5">
            <Avatar name={coachName} src={coach?.photo_url || undefined} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-boon-navy text-[22px] leading-tight tracking-[-0.015em]">
                {coachName}
              </h2>
              {coach?.headline && (
                <Eyebrow color="blue" className="mt-1.5">
                  {coach.headline}
                </Eyebrow>
              )}
              {coach?.notable_credentials && (
                <p className="mt-1 text-xs text-boon-charcoal/55 leading-relaxed">
                  {coach.notable_credentials}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-btn bg-boon-offWhite border border-boon-charcoal/[0.06]">
            <p className="text-sm text-boon-charcoal/80 leading-relaxed">{displayMatchSummary}</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <Eyebrow color="muted">Sessions</Eyebrow>
              <div className="mt-1.5 font-display font-bold text-boon-navy text-[28px] leading-none tracking-[-0.02em]">
                {completedWithCoach.length}
              </div>
            </div>
            <div>
              <Eyebrow color="muted">Months</Eyebrow>
              <div className="mt-1.5 font-display font-bold text-boon-navy text-[28px] leading-none tracking-[-0.02em]">
                {monthsTogether}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              as="a"
              href={`mailto:${coach?.email || 'coaching@boon-health.com'}?subject=Message for ${coachName}`}
              variant="primary"
              size="md"
              className="w-full justify-center"
            >
              Message {coachFirstName}
            </Button>
            {bookingLink && (
              <Button
                as="a"
                href={bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="md"
                className="w-full justify-center"
              >
                Book a session
              </Button>
            )}
          </div>
        </Card>

        {/* ─────────────── Right column ─────────────── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* About */}
          <Card padding="lg">
            <Eyebrow color="coral">About {coachFirstName}</Eyebrow>
            <Headline as="h3" size="md" className="mt-2">
              How {coachFirstName} works.
            </Headline>
            <p className="mt-4 text-[15px] text-boon-charcoal/80 leading-relaxed">
              {bioExpanded ? coachBio : truncateBio(coachBio, 280)}
            </p>
            {coachBio.length > 280 && (
              <button
                onClick={() => setBioExpanded(!bioExpanded)}
                className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-boon-blue hover:text-boon-darkBlue transition-colors"
              >
                {bioExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {specialties.map(skill => (
                <Badge key={skill} variant="neutral">{skill}</Badge>
              ))}
            </div>
          </Card>

          {/* Session History */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <Eyebrow color="coral">Session history</Eyebrow>
              {historyWithCoach.length > 5 && (
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-boon-charcoal/55">
                  Showing 5 of {historyWithCoach.length}
                </span>
              )}
            </div>
            {historyWithCoach.length > 0 ? (
              <div className="flex flex-col gap-2">
                {historyWithCoach.slice(0, 5).map(s => {
                  const themes: string[] = [];
                  if (s.leadership_management_skills) themes.push('Leadership');
                  if (s.communication_skills) themes.push('Communication');
                  if (s.mental_well_being) themes.push('Wellbeing');
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-btn bg-white border border-boon-charcoal/[0.08] hover:border-boon-blue/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-display font-bold text-boon-navy text-[15px] leading-tight">
                          {new Date(s.session_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        {themes.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {themes.map(theme => (
                              <span
                                key={theme}
                                className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-boon-charcoal/60"
                              >
                                {theme}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge variant={s.status === 'Completed' ? 'success' : 'neutral'}>
                        {s.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm italic text-boon-charcoal/60">
                No sessions yet with {coachName}.
              </p>
            )}
          </Card>

          {/* Quick Tips */}
          <Card variant="coral-outlined" padding="lg" accent>
            <Eyebrow color="coral">Make it count</Eyebrow>
            <Headline as="h3" size="sm" className="mt-2">
              Getting the most.{' '}
              <Headline.Kicker color="blue">From every session.</Headline.Kicker>
            </Headline>
            <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-boon-charcoal/80 leading-relaxed">
              <li className="flex gap-2.5">
                <span aria-hidden className="text-boon-coral mt-0.5">·</span>
                <span>Come with a specific situation or challenge in mind.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="text-boon-coral mt-0.5">·</span>
                <span>Share what's been on your mind since the last session.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="text-boon-coral mt-0.5">·</span>
                <span>Be open about what's working and what's not.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="text-boon-coral mt-0.5">·</span>
                <span>Ask {coachFirstName} for specific tools or frameworks when helpful.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
