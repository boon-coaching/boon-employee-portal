import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import type { CoachingStateData } from '../lib/coachingState';
import { isAlumniState } from '../lib/coachingState';

interface LayoutProps {
  children: React.ReactNode;
  coachingState?: CoachingStateData;
  badges?: Record<string, boolean>;
}

export default function Layout({ children, coachingState, badges }: LayoutProps) {
  const { employee, signOut } = useAuth();

  const isCompleted = coachingState ? isAlumniState(coachingState.state) : false;

  const showGoals = coachingState && !isCompleted && coachingState.state !== 'NOT_SIGNED_UP' && coachingState.state !== 'SIGNED_UP_NOT_MATCHED';

  const navItems: { to: string; label: string; icon: string; end?: boolean }[] = [
    { to: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', end: true },
    ...(showGoals ? [{ to: '/goals', label: 'Goals', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }] : []),
    ...(showGoals ? [{ to: '/journal', label: 'Journal', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' }] : []),
    { to: '/practice', label: 'Practice', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { to: '/sessions', label: isCompleted ? 'Archive' : 'Sessions', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { to: '/progress', label: isCompleted ? 'Profile' : 'Progress', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
    { to: '/resources', label: 'Resources', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  ];

  const initials = employee
    ? `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase()
    : 'ME';

  const programLabel = coachingState?.isScale
    ? 'Your Scale access'
    : 'Your Grow program';

  return (
    <div className="flex flex-col min-h-screen bg-boon-bg pb-[calc(72px+env(safe-area-inset-bottom,16px))] md:pb-0 md:pl-60">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-boon-charcoal/[0.08] z-30">
        <div className="px-4 py-6 flex flex-col h-full">
          <img
            src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Wordmark_Blue_16_aw7lvc.png"
            className="h-6 max-w-[120px] object-contain mb-7 ml-3"
            alt="Boon Health"
          />

          <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/45">
            {programLabel}
          </div>

          <nav className="flex-1 space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-btn transition-all ${
                    isActive
                      ? 'bg-boon-blue/10 text-boon-darkBlue font-bold'
                      : 'text-boon-charcoal/75 font-medium hover:bg-boon-blue/5 hover:text-boon-navy'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute -left-4 top-2 bottom-2 w-[3px] bg-boon-blue rounded-pill"
                      />
                    )}
                    <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                    {badges?.[item.to] && (
                      <span className="ml-auto w-1.5 h-1.5 bg-boon-coral rounded-pill" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User block */}
          <div className="pt-4 border-t border-boon-charcoal/[0.08]">
            <div className="flex items-center gap-3 px-2 py-2.5">
              <div className="w-9 h-9 rounded-pill bg-boon-blue/10 flex items-center justify-center shrink-0">
                <span className="text-boon-blue text-[11px] font-bold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-boon-navy truncate leading-tight">
                  {employee?.first_name} {employee?.last_name}
                </p>
                <p className="text-[11px] text-boon-charcoal/55 truncate mt-0.5">{employee?.job_title || 'Employee'}</p>
              </div>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `p-1.5 rounded-btn transition-colors shrink-0 ${
                    isActive
                      ? 'text-boon-blue bg-boon-blue/10'
                      : 'text-boon-charcoal/45 hover:text-boon-blue hover:bg-boon-blue/5'
                  }`
                }
                title="Settings"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </NavLink>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-boon-charcoal/55 hover:text-boon-error transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 bg-white border-b border-boon-charcoal/[0.08] sticky top-0 z-30">
        <img
          src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Wordmark_Blue_16_aw7lvc.png"
          className="h-5 max-w-[100px] object-contain"
          alt="Boon Health"
        />
        <div className="flex items-center gap-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `p-2 rounded-btn transition-colors ${
                isActive
                  ? 'bg-boon-blue text-white'
                  : 'text-boon-charcoal/55 hover:text-boon-blue'
              }`
            }
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </NavLink>
          <div className="w-8 h-8 rounded-pill bg-boon-blue/10 flex items-center justify-center">
            <span className="text-boon-blue text-xs font-bold">{initials}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-5 md:px-8 py-6 md:py-10">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-boon-charcoal/[0.08] flex justify-between items-stretch px-1 pt-2 pb-[env(safe-area-inset-bottom,12px)] z-30">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center gap-0.5 px-0.5 py-1 transition-all active:scale-95 ${
                isActive ? 'text-boon-blue' : 'text-boon-charcoal/55'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative p-1.5 rounded-btn transition-colors ${isActive ? 'bg-boon-blue/10' : ''}`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {badges?.[item.to] && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-boon-error rounded-pill" />
                  )}
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider truncate w-full text-center leading-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
