import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

export default function Settings() {
  const { employee, signOut } = useAuth();
  const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus>({
    connected: false,
    settings: null,
  });
  const [teamsStatus, setTeamsStatus] = useState<TeamsConnectionStatus>({
    connected: false,
    settings: null,
  });
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

  // Form state
  const [nudgeEnabled, setNudgeEnabled] = useState(true);
  const [nudgeFrequency, setNudgeFrequency] = useState<'smart' | 'daily' | 'weekly' | 'none'>('smart');
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [timezone, setTimezone] = useState('America/New_York');

  // Check for success/error params from OAuth redirect
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
          setTeamsStatus((prev) => ({
            ...prev,
            settings: prev.settings ? { ...prev.settings, ...settingsPayload } : null,
          }));
        } else {
          setSlackStatus((prev) => ({
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
    if (!confirm(`Are you sure you want to disconnect ${channelLabel}? You will stop receiving coaching nudges.`)) {
      return;
    }

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
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-boon-blue border-t-transparent rounded-pill animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-boon-navy">Settings</h1>
        <p className="text-boon-charcoal/55 mt-1">Manage your notifications and integrations</p>
      </div>

      {/* Coaching Nudges Card */}
      <div className="bg-white rounded-card shadow-sm border border-boon-charcoal/[0.08] overflow-hidden">
        <div className="p-6 border-b border-boon-charcoal/[0.08]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-btn bg-boon-lightBlue/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-boon-navy">Coaching Nudges</h2>
              <p className="text-sm text-boon-charcoal/55">
                Get friendly reminders about your coaching goals and action items
              </p>
            </div>
            {connected ? (
              <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-pill">
                {activeChannel === 'teams' ? <TeamsIcon className="w-4 h-4" /> : <SlackIcon className="w-4 h-4" />}
                Connected via {channelLabel}
              </span>
            ) : (
              <span className="px-3 py-1 bg-boon-offWhite text-boon-charcoal/55 text-sm font-medium rounded-pill">
                Not connected
              </span>
            )}
          </div>
        </div>

        {connected ? (
          <div className="p-6 space-y-6">
            {/* Nudge Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-boon-navy">Enable Nudges</h3>
                <p className="text-sm text-boon-charcoal/55">
                  Receive {channelLabel} messages about your coaching journey
                </p>
              </div>
              <button
                onClick={() => setNudgeEnabled(!nudgeEnabled)}
                className={`relative w-12 h-6 rounded-pill transition-colors ${
                  nudgeEnabled ? 'bg-boon-blue' : 'bg-boon-charcoal/20'
                }`}
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
                  <h3 className="font-medium text-boon-navy mb-3">Nudge Frequency</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { value: 'smart', label: 'Smart', desc: 'Based on your activity' },
                      { value: 'daily', label: 'Daily', desc: 'Once per day' },
                      { value: 'weekly', label: 'Weekly', desc: 'Monday digest' },
                      { value: 'none', label: 'None', desc: 'Only urgent' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setNudgeFrequency(option.value as typeof nudgeFrequency)}
                        className={`p-3 rounded-btn border-2 text-left transition-colors ${
                          nudgeFrequency === option.value
                            ? 'border-boon-blue bg-boon-lightBlue/30'
                            : 'border-boon-charcoal/[0.08] hover:border-boon-charcoal/[0.08]'
                        }`}
                      >
                        <div className="font-medium text-boon-navy">{option.label}</div>
                        <div className="text-xs text-boon-charcoal/55">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferred Time */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-boon-navy mb-2">Preferred Time</label>
                    <input
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full px-4 py-2.5 border border-boon-charcoal/[0.08] rounded-btn focus:outline-none focus:ring-2 focus:ring-boon-blue/20 focus:border-boon-blue"
                    />
                    <p className="text-xs text-boon-charcoal/55 mt-1">Nudges will be sent around this time</p>
                  </div>
                  <div>
                    <label className="block font-medium text-boon-navy mb-2">Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-4 py-2.5 border border-boon-charcoal/[0.08] rounded-btn focus:outline-none focus:ring-2 focus:ring-boon-blue/20 focus:border-boon-blue"
                    >
                      {timezones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Save / Disconnect buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-boon-charcoal/[0.08]">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-boon-error hover:text-red-700 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting...' : `Disconnect ${channelLabel}`}
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-boon-blue text-white font-medium rounded-btn hover:bg-boon-blue/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="bg-boon-lightBlue/30 rounded-btn p-4 mb-6">
              <h3 className="font-medium text-boon-navy mb-2">What you'll get:</h3>
              <ul className="space-y-2 text-sm text-boon-charcoal/75">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-boon-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Reminders about your action items before they're due
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-boon-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Check-ins on your coaching goals a few days after sessions
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-boon-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Session prep prompts before upcoming coaching sessions
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleConnectSlack}
                className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-[#4A154B] text-white font-medium rounded-btn hover:bg-[#3a1039] transition-colors"
              >
                <SlackIcon className="w-5 h-5" />
                Connect Slack
              </button>
              <button
                onClick={handleConnectTeams}
                className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-[#6264A7] text-white font-medium rounded-btn hover:bg-[#4f5199] transition-colors"
              >
                <TeamsIcon className="w-5 h-5" />
                Connect Microsoft Teams
              </button>
              <p className="text-xs text-boon-charcoal/55 text-center">
                For Teams, install the Boon Coaching app in your Microsoft Teams workspace first.{' '}
                <a
                  href="https://www.boon-health.com/teams-support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-boon-blue hover:text-boon-darkBlue underline"
                >
                  Learn how
                </a>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nudge Analytics (only show if connected and has history) */}
      {connected && nudgeHistory.length > 0 && (
        <div className="bg-white rounded-card shadow-sm border border-boon-charcoal/[0.08] overflow-hidden">
          <div className="p-6 border-b border-boon-charcoal/[0.08]">
            <h2 className="text-lg font-semibold text-boon-navy">Your Nudge Engagement</h2>
            <p className="text-sm text-boon-charcoal/55 mt-1">Track how you're responding to coaching reminders</p>
          </div>

          {/* Analytics Cards */}
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-boon-charcoal/[0.08]">
            {(() => {
              const responded = nudgeHistory.filter(n => n.status === 'responded').length;
              const total = nudgeHistory.length;
              const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
              const completedActions = nudgeHistory.filter(n => n.response === 'action_done' || n.response === 'complete_action_item').length;
              const inProgress = nudgeHistory.filter(n => n.response === 'action_in_progress').length;
              const greatProgress = nudgeHistory.filter(n => n.response === 'progress_great').length;

              return (
                <>
                  <div className="bg-gradient-to-br from-boon-blue/10 to-boon-blue/5 rounded-btn p-4">
                    <div className="text-3xl font-bold text-boon-blue">{responseRate}%</div>
                    <div className="text-sm text-boon-charcoal/75 mt-1">Response Rate</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-btn p-4">
                    <div className="text-3xl font-bold text-boon-success">{completedActions}</div>
                    <div className="text-sm text-boon-charcoal/75 mt-1">Actions Done</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-btn p-4">
                    <div className="text-3xl font-bold text-boon-blue">{inProgress}</div>
                    <div className="text-sm text-boon-charcoal/75 mt-1">In Progress</div>
                  </div>
                  <div className="bg-boon-purple/12 rounded-btn p-4">
                    <div className="text-3xl font-bold text-boon-purple">{greatProgress}</div>
                    <div className="text-sm text-boon-charcoal/75 mt-1">Great Progress</div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Nudge Type Breakdown */}
          <div className="p-6 border-b border-boon-charcoal/[0.08]">
            <h3 className="font-medium text-boon-navy mb-4">Nudge Breakdown</h3>
            <div className="space-y-3">
              {(() => {
                const typeCount = nudgeHistory.reduce((acc, n) => {
                  acc[n.nudge_type] = (acc[n.nudge_type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                const typeLabels: Record<string, { label: string; color: string; icon: string }> = {
                  action_reminder: { label: 'Action Reminders', color: 'bg-orange-500', icon: '📋' },
                  goal_checkin: { label: 'Goal Check-ins', color: 'bg-boon-blue', icon: '🎯' },
                  session_prep: { label: 'Session Prep', color: 'bg-boon-purple/100', icon: '📅' },
                  weekly_digest: { label: 'Weekly Digest', color: 'bg-boon-success', icon: '📊' },
                  daily_digest: { label: 'Daily Digest', color: 'bg-boon-warning', icon: '📰' },
                };

                const total = nudgeHistory.length;

                return Object.entries(typeCount).map(([type, count]) => {
                  const info = typeLabels[type] || { label: type, color: 'bg-boon-offWhite0', icon: '📨' };
                  const pct = Math.round((count / total) * 100);

                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xl">{info.icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-boon-charcoal/75">{info.label}</span>
                          <span className="text-boon-charcoal/55">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-boon-offWhite rounded-pill overflow-hidden">
                          <div className={`h-full ${info.color} rounded-pill`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Recent Nudges */}
          <div className="p-6 border-b border-boon-charcoal/[0.08]">
            <h3 className="font-medium text-boon-navy mb-4">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {nudgeHistory.slice(0, 5).map((nudge) => (
              <div key={nudge.id} className="p-4 flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-pill flex items-center justify-center ${
                    nudge.status === 'responded'
                      ? 'bg-green-100'
                      : nudge.status === 'sent'
                      ? 'bg-boon-blue/10'
                      : 'bg-boon-offWhite'
                  }`}
                >
                  {nudge.nudge_type === 'action_reminder' || nudge.nudge_type === 'daily_digest' ? (
                    <svg className="w-5 h-5 text-boon-charcoal/75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  ) : nudge.nudge_type === 'goal_checkin' ? (
                    <svg className="w-5 h-5 text-boon-charcoal/75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-boon-charcoal/75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-boon-navy">
                      {nudge.nudge_type === 'action_reminder' && 'Action Reminder'}
                      {nudge.nudge_type === 'goal_checkin' && 'Goal Check-in'}
                      {nudge.nudge_type === 'session_prep' && 'Session Prep'}
                      {nudge.nudge_type === 'weekly_digest' && 'Weekly Digest'}
                      {nudge.nudge_type === 'daily_digest' && 'Daily Digest'}
                    </span>
                    {nudge.channel && (
                      <span className="text-xs text-boon-charcoal/55">
                        via {nudge.channel === 'teams' ? 'Microsoft Teams' : 'Slack'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-boon-charcoal/55">
                    {new Date(nudge.sent_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div>
                  {nudge.status === 'responded' && nudge.response && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-pill">
                      {nudge.response.replace('action_', '').replace('progress_', '').replace('complete_', '')}
                    </span>
                  )}
                  {nudge.status === 'sent' && (
                    <span className="px-2 py-1 bg-boon-offWhite text-boon-charcoal/55 text-xs font-medium rounded-pill">
                      Sent
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Section */}
      <div className="bg-white rounded-card shadow-sm border border-boon-charcoal/[0.08] overflow-hidden">
        <div className="p-6 border-b border-boon-charcoal/[0.08]">
          <h2 className="text-lg font-semibold text-boon-navy">Account</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-boon-navy">
                {employee?.first_name} {employee?.last_name}
              </div>
              <div className="text-sm text-boon-charcoal/55">{employee?.company_email}</div>
            </div>
          </div>
          <div className="pt-4 border-t border-boon-charcoal/[0.08] space-y-3">
            <Link
              to="/help/privacy"
              className="flex items-center gap-2 text-boon-blue hover:text-boon-darkBlue font-medium text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Privacy & Confidentiality
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-boon-error hover:text-red-700 font-medium text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Platform icon components

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

