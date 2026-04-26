import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, Headline, Button, Badge } from '../lib/design-system';
import { useAuth } from '../lib/AuthContext';
import {
  fetchSlackConnectionStatus,
  getSlackConnectUrl,
  disconnectSlack,
  updateSlackSettings,
  fetchTeamsConnectionStatus,
  getTeamsConnectUrl,
  disconnectTeams,
  updateTeamsSettings,
  fetchNudgeHistory,
} from '../lib/dataFetcher';
import type { SlackConnectionStatus, TeamsConnectionStatus, Nudge } from '../lib/types';

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

const NUDGE_TYPE_LABELS: Record<string, string> = {
  action_reminder: 'Action reminders',
  goal_checkin: 'Goal check-ins',
  session_prep: 'Session prep',
  weekly_digest: 'Weekly digest',
  daily_digest: 'Daily digest',
};

const NUDGE_TYPE_BAR_COLOR: Record<string, string> = {
  action_reminder: 'bg-boon-coral',
  goal_checkin: 'bg-boon-blue',
  session_prep: 'bg-boon-navy',
  weekly_digest: 'bg-boon-success',
  daily_digest: 'bg-boon-warning',
};

const NUDGE_RESPONSE_LABELS: Record<string, string> = {
  action_done: 'Done',
  action_in_progress: 'In progress',
  action_skip: 'Skipped',
  progress_great: 'Great',
  progress_ok: 'Okay',
  progress_stuck: 'Stuck',
  complete_yes: 'Yes',
  complete_no: 'No',
  complete_maybe: 'Maybe',
};

function formatNudgeResponse(response: string): string {
  if (NUDGE_RESPONSE_LABELS[response]) return NUDGE_RESPONSE_LABELS[response];
  // Unknown enum: strip prefix + title-case as a graceful fallback.
  const stripped = response.replace(/^(action_|progress_|complete_)/, '').replace(/_/g, ' ');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export default function Settings() {
  const { employee, signOut } = useAuth();
  const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus>({ connected: false, settings: null });
  const [teamsStatus, setTeamsStatus] = useState<TeamsConnectionStatus>({ connected: false, settings: null });
  const [nudgeHistory, setNudgeHistory] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const activeChannel: 'slack' | 'teams' | null = slackStatus.connected
    ? 'slack'
    : teamsStatus.connected
    ? 'teams'
    : null;
  const connected = activeChannel !== null;
  const channelLabel = activeChannel === 'teams' ? 'Microsoft Teams' : 'Slack';

  const [nudgeEnabled, setNudgeEnabled] = useState(true);
  const [nudgeFrequency, setNudgeFrequency] = useState<'smart' | 'daily' | 'weekly' | 'none'>('smart');
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack_connected') === 'true' || params.get('teams_connected') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      console.error('Connection error:', params.get('error'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [slack, teams, history] = await Promise.all([
          fetchSlackConnectionStatus(),
          fetchTeamsConnectionStatus(),
          employee?.company_email ? fetchNudgeHistory(employee.company_email) : Promise.resolve([]),
        ]);

        setSlackStatus(slack);
        setTeamsStatus(teams);
        setNudgeHistory(history);

        const activeSettings = slack.connected
          ? slack.settings
          : teams.connected
          ? teams.settings
          : null;

        if (activeSettings) {
          setNudgeEnabled(activeSettings.nudge_enabled);
          setNudgeFrequency(activeSettings.nudge_frequency);
          setPreferredTime(activeSettings.preferred_time?.slice(0, 5) || '09:00');
          setTimezone(activeSettings.timezone || 'America/New_York');
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [employee?.company_email]);

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const settingsPayload = {
        nudge_enabled: nudgeEnabled,
        nudge_frequency: nudgeFrequency,
        preferred_time: preferredTime,
        timezone,
      };

      const success = activeChannel === 'teams'
        ? await updateTeamsSettings(settingsPayload)
        : await updateSlackSettings(settingsPayload);

      if (success) {
        if (activeChannel === 'teams') {
          setTeamsStatus(prev => ({
            ...prev,
            settings: prev.settings ? { ...prev.settings, ...settingsPayload } : null,
          }));
        } else {
          setSlackStatus(prev => ({
            ...prev,
            settings: prev.settings ? { ...prev.settings, ...settingsPayload } : null,
          }));
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${channelLabel}? You will stop receiving coaching nudges.`)) return;
    setDisconnecting(true);
    try {
      const success = activeChannel === 'teams' ? await disconnectTeams() : await disconnectSlack();
      if (success) {
        if (activeChannel === 'teams') {
          setTeamsStatus({ connected: false, settings: null });
        } else {
          setSlackStatus({ connected: false, settings: null });
        }
      }
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnectSlack() {
    if (employee?.company_email) {
      window.location.href = getSlackConnectUrl(employee.company_email);
    }
  }
  function handleConnectTeams() {
    if (employee?.company_email) {
      window.location.href = getTeamsConnectUrl(employee.company_email);
    }
  }

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona (no DST)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
    { value: 'America/Anchorage', label: 'Alaska Time' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Central European Time' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-boon-blue border-t-transparent rounded-pill animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* ─────────────── Editorial hero ─────────────── */}
      <header className="pb-6 mb-8 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <Eyebrow color="blue">Settings</Eyebrow>
        </div>
        <Headline as="h1" size="lg">
          How you want it.{' '}
          <span className="font-serif italic font-normal text-boon-coral">Tuned to you.</span>
        </Headline>
      </header>

      <div className="flex flex-col gap-6">
        {/* ─────────────── Coaching nudges ─────────────── */}
        <Card padding="lg">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <Eyebrow color="coral">Nudges</Eyebrow>
              <Headline as="h2" size="md" className="mt-2">
                Coaching, in flow.
              </Headline>
              <p className="mt-2 text-sm text-boon-charcoal/70 leading-relaxed">
                Friendly check-ins about your goals and action items, delivered where you already work.
              </p>
            </div>
            {connected ? (
              <Badge variant="success">Connected via {channelLabel}</Badge>
            ) : (
              <Badge variant="neutral">Not connected</Badge>
            )}
          </div>

          {connected ? (
            <div className="mt-4 flex flex-col gap-6">
              {/* Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-display font-bold text-boon-navy text-[15px]">
                    Send me nudges
                  </div>
                  <p className="mt-1 text-sm text-boon-charcoal/65">
                    {channelLabel} messages about your coaching journey.
                  </p>
                </div>
                <button
                  onClick={() => setNudgeEnabled(!nudgeEnabled)}
                  className={`relative w-12 h-6 rounded-pill transition-colors flex-shrink-0 ${
                    nudgeEnabled ? 'bg-boon-blue' : 'bg-boon-charcoal/20'
                  }`}
                  aria-pressed={nudgeEnabled}
                  aria-label="Toggle nudges"
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-pill shadow transition-transform ${
                      nudgeEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {nudgeEnabled && (
                <>
                  {/* Frequency */}
                  <div>
                    <Eyebrow color="muted" className="mb-3">Frequency</Eyebrow>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {[
                        { value: 'smart', label: 'Smart', desc: 'Based on your activity' },
                        { value: 'daily', label: 'Daily', desc: 'Once per day' },
                        { value: 'weekly', label: 'Weekly', desc: 'Monday digest' },
                        { value: 'none', label: 'None', desc: 'Only urgent' },
                      ].map((option) => {
                        const selected = nudgeFrequency === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setNudgeFrequency(option.value as typeof nudgeFrequency)}
                            className={`p-3.5 rounded-btn border text-left transition-colors ${
                              selected
                                ? 'border-boon-blue bg-boon-blue/[0.06]'
                                : 'border-boon-charcoal/[0.10] hover:border-boon-blue/40'
                            }`}
                          >
                            <div className={`font-display font-bold text-[15px] ${selected ? 'text-boon-blue' : 'text-boon-navy'}`}>
                              {option.label}
                            </div>
                            <div className="text-xs text-boon-charcoal/60 mt-0.5">{option.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time + timezone */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Eyebrow color="muted" className="mb-2">Preferred time</Eyebrow>
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-boon-charcoal/[0.12] rounded-btn focus:outline-none focus:border-boon-blue text-sm"
                      />
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-boon-charcoal/45 mt-1.5">
                        Sent around this time
                      </p>
                    </div>
                    <div>
                      <Eyebrow color="muted" className="mb-2">Timezone</Eyebrow>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-boon-charcoal/[0.12] rounded-btn focus:outline-none focus:border-boon-blue text-sm bg-white"
                      >
                        {timezones.map((tz) => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Save / Disconnect */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-boon-charcoal/[0.08]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting...' : `Disconnect ${channelLabel}`}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveSettings}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save settings'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              <div className="p-4 rounded-btn bg-boon-offWhite border border-boon-charcoal/[0.06]">
                <Eyebrow color="muted" className="mb-3">What you'll get</Eyebrow>
                <ul className="flex flex-col gap-2 text-sm text-boon-charcoal/80">
                  <li className="flex gap-2.5">
                    <span aria-hidden className="text-boon-blue mt-0.5">·</span>
                    <span>Reminders before action items are due.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span aria-hidden className="text-boon-blue mt-0.5">·</span>
                    <span>Check-ins on your coaching goals a few days after sessions.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span aria-hidden className="text-boon-blue mt-0.5">·</span>
                    <span>Session prep prompts before upcoming coaching sessions.</span>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleConnectSlack}
                  className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-[#4A154B] text-white text-sm font-display font-medium rounded-btn hover:bg-[#3a1039] transition-colors"
                >
                  <SlackIcon className="w-5 h-5" />
                  Connect Slack
                </button>
                <button
                  onClick={handleConnectTeams}
                  className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-[#6264A7] text-white text-sm font-display font-medium rounded-btn hover:bg-[#4f5199] transition-colors"
                >
                  <TeamsIcon className="w-5 h-5" />
                  Connect Microsoft Teams
                </button>
                <p className="text-[11px] text-boon-charcoal/55 text-center mt-1">
                  For Teams, install the Boon Coaching app in your workspace first.{' '}
                  <a
                    href="https://www.boon-health.com/teams-support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-boon-blue hover:text-boon-darkBlue underline"
                  >
                    Learn how
                  </a>.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* ─────────────── Nudge engagement ─────────────── */}
        {connected && nudgeHistory.length > 0 && (() => {
          const responded = nudgeHistory.filter(n => n.status === 'responded').length;
          const total = nudgeHistory.length;
          const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
          const completedActions = nudgeHistory.filter(n => n.response === 'action_done' || n.response === 'complete_action_item').length;
          const inProgress = nudgeHistory.filter(n => n.response === 'action_in_progress').length;
          const greatProgress = nudgeHistory.filter(n => n.response === 'progress_great').length;

          const typeCount = nudgeHistory.reduce((acc, n) => {
            acc[n.nudge_type] = (acc[n.nudge_type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <Card padding="lg">
              <Eyebrow color="coral">Engagement</Eyebrow>
              <Headline as="h2" size="md" className="mt-2">
                How you're responding.
              </Headline>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { eyebrow: 'Response rate', value: `${responseRate}%`, color: 'text-boon-blue' },
                  { eyebrow: 'Actions done', value: `${completedActions}`, color: 'text-boon-success' },
                  { eyebrow: 'In progress', value: `${inProgress}`, color: 'text-boon-blue' },
                  { eyebrow: 'Great progress', value: `${greatProgress}`, color: 'text-boon-coral' },
                ].map(stat => (
                  <div key={stat.eyebrow} className="p-4 rounded-btn bg-boon-offWhite border border-boon-charcoal/[0.06]">
                    <Eyebrow color="muted">{stat.eyebrow}</Eyebrow>
                    <div className={`mt-1.5 font-display font-bold text-[28px] leading-none tracking-[-0.02em] ${stat.color}`}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7">
                <Eyebrow color="muted" className="mb-3">Breakdown by type</Eyebrow>
                <div className="flex flex-col gap-3">
                  {Object.entries(typeCount).map(([type, count]) => {
                    const label = NUDGE_TYPE_LABELS[type] || type;
                    const barColor = NUDGE_TYPE_BAR_COLOR[type] || 'bg-boon-charcoal/30';
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-boon-charcoal/80">{label}</span>
                          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-boon-charcoal/55">
                            {count} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-boon-offWhite rounded-pill overflow-hidden">
                          <div className={`h-full ${barColor} rounded-pill transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-7">
                <Eyebrow color="muted" className="mb-3">Recent activity</Eyebrow>
                <div className="flex flex-col gap-2">
                  {nudgeHistory.slice(0, 5).map((nudge) => (
                    <div
                      key={nudge.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-btn bg-white border border-boon-charcoal/[0.08]"
                    >
                      <div className="min-w-0">
                        <div className="font-display font-bold text-boon-navy text-sm">
                          {NUDGE_TYPE_LABELS[nudge.nudge_type] || nudge.nudge_type}
                          {nudge.channel && (
                            <span className="ml-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-boon-charcoal/55">
                              via {nudge.channel === 'teams' ? 'Teams' : 'Slack'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-boon-charcoal/60 mt-0.5">
                          {new Date(nudge.sent_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      {nudge.status === 'responded' && nudge.response ? (
                        <Badge variant="success">{formatNudgeResponse(nudge.response)}</Badge>
                      ) : nudge.status === 'sent' ? (
                        <Badge variant="neutral">Sent</Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })()}

        {/* ─────────────── Account ─────────────── */}
        <Card padding="lg">
          <Eyebrow color="coral">Account</Eyebrow>
          <Headline as="h2" size="md" className="mt-2">
            You.
          </Headline>
          <div className="mt-5 p-4 rounded-btn bg-boon-offWhite border border-boon-charcoal/[0.06]">
            <div className="font-display font-bold text-boon-navy text-[15px]">
              {employee?.first_name} {employee?.last_name}
            </div>
            <div className="text-sm text-boon-charcoal/60 mt-0.5">{employee?.company_email}</div>
          </div>
          <div className="mt-5 pt-5 border-t border-boon-charcoal/[0.08] flex items-center justify-between gap-3 flex-wrap">
            <Link
              to="/help/privacy"
              className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-boon-blue hover:text-boon-darkBlue transition-colors"
            >
              Privacy & confidentiality →
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface IconProps {
  className?: string;
}

function SlackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" />
    </svg>
  );
}

function TeamsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5h13v3h-4.5v11h-4V8H3V5zm15.5 4.5h2.5a1.5 1.5 0 0 1 1.5 1.5v6a3 3 0 0 1-3 3h-1V9.5z" />
    </svg>
  );
}
