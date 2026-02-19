import { useState } from 'react';

export function PreviewBanner() {
  const [email, setEmail] = useState('');

  if (!import.meta.env.VITE_PREVIEW_MODE) return null;

  const currentEmail = new URLSearchParams(window.location.search).get('email')
    || localStorage.getItem('boon_preview_email')
    || 'No user loaded';

  function handleSwitch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    window.location.href = `/?email=${encodeURIComponent(email.trim())}`;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-400 text-amber-900 px-4 py-2 flex items-center justify-between text-sm font-medium shadow-md">
      <span>Preview Mode: <strong>{currentEmail}</strong></span>
      <form onSubmit={handleSwitch} className="flex items-center gap-2">
        <input
          type="email"
          placeholder="Switch to email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-2 py-1 rounded text-sm border border-amber-600 bg-amber-50 text-amber-900 placeholder-amber-500 w-64"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
        >
          Switch
        </button>
      </form>
    </div>
  );
}
