import { Link } from 'react-router-dom';

export default function TeamsSupportPage() {
  return (
    <div className="min-h-screen bg-boon-bg">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <Link to="/login" className="inline-flex items-center gap-2 text-boon-blue hover:underline text-sm font-medium mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to portal
          </Link>
          <img
            src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Wordmark_Blue_16_aw7lvc.png"
            alt="Boon Health"
            className="h-8 max-w-[140px] object-contain"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-black text-boon-text mb-2">
          Boon Coaching for Microsoft Teams
        </h1>
        <p className="text-gray-500 mb-10">
          Get coaching nudges, reminders, and check-ins right where you work.
        </p>

        {/* What the app does */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-boon-text">What the app does</h2>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <p className="text-gray-700 mb-4">
              The Boon Coaching Teams app delivers personalized coaching support directly in Microsoft Teams. You'll receive:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700"><strong>Action item reminders</strong> to keep you on track between coaching sessions</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700"><strong>Goal check-ins</strong> with quick-tap progress updates</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700"><strong>Session prep notifications</strong> before your upcoming coaching sessions</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700"><strong>Interactive cards</strong> you can respond to without leaving Teams</span>
              </li>
            </ul>
          </div>
        </section>

        {/* How to install */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-boon-text">How to install</h2>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0 mt-0.5">1</span>
                <span className="text-gray-700">Open the <strong>Apps</strong> section in Microsoft Teams (left sidebar)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0 mt-0.5">2</span>
                <span className="text-gray-700">Search for <strong>"Boon Coaching"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0 mt-0.5">3</span>
                <span className="text-gray-700">Click <strong>Add</strong> to install the app to your personal chat</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0 mt-0.5">4</span>
                <span className="text-gray-700">You'll see a welcome message confirming the app is ready</span>
              </li>
            </ol>
            <p className="text-gray-500 text-sm mt-4">
              Note: Your IT admin may need to approve the app for your organization first. If you don't see it in the app store, contact your IT team.
            </p>
          </div>
        </section>

        {/* Connecting your account */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-boon-text">Connecting your account</h2>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <p className="text-gray-700 mb-3">
              The Boon Coaching Teams app is automatically linked to your Boon account through your organization's setup. No manual account linking is required.
            </p>
            <p className="text-gray-700">
              If you have an active Boon coaching program, nudges will start appearing in Teams based on your coaching schedule and action items. You can also access your full coaching portal at{' '}
              <a href="https://my.boon-health.com" className="text-boon-blue font-medium hover:underline">
                my.boon-health.com
              </a>.
            </p>
          </div>
        </section>

        {/* Notification preferences */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-boon-text">Notification preferences</h2>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <p className="text-gray-700 mb-3">
              Nudges are sent at thoughtful intervals based on your coaching program. They're designed to be helpful, not overwhelming.
            </p>
            <p className="text-gray-700">
              If you'd like to adjust your notification preferences or pause nudges, contact your Boon program administrator or reach out to our support team.
            </p>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-boon-text">Privacy</h2>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <p className="text-gray-700 mb-3">
              Your coaching conversations are confidential. The Teams app only sends nudges and reminders. It does not read your Teams messages, access your calendar, or share data with your employer beyond anonymized program metrics.
            </p>
            <p className="text-gray-700">
              For full details, see our{' '}
              <a href="https://www.boon-health.com/privacy" className="text-boon-blue font-medium hover:underline">
                Privacy Policy
              </a>{' '}
              and{' '}
              <Link to="/help/privacy" className="text-boon-blue font-medium hover:underline">
                Privacy & Confidentiality guide
              </Link>.
            </p>
          </div>
        </section>

        {/* Contact support */}
        <section className="bg-boon-blue/5 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-bold text-boon-text mb-2">Need help?</h2>
          <p className="text-gray-600 mb-4">
            Our support team is ready to help with any questions about the Teams app.
          </p>
          <a
            href="mailto:support@boon-health.com"
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            support@boon-health.com
          </a>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 bg-white mt-10">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Boon Health. All rights reserved.
        </div>
      </div>
    </div>
  );
}
