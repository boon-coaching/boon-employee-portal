import { useAuth } from '../lib/AuthContext';

export default function MatchingPage() {
  const { employee, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-boon-bg">
      {/* Minimal Header */}
      <header className="p-6">
        <img
          src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863862/Logo_Blue_2_kl7tot.png"
          alt="Boon"
          className="h-8"
        />
      </header>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg animate-fade-in">
          {/* Matching Card */}
          <div className="bg-white rounded-[2.5rem] p-10 md:p-12 shadow-sm border border-gray-100 text-center">
            {/* Animated Icon */}
            <div className="w-24 h-24 bg-gradient-to-br from-boon-lightBlue to-boon-blue/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
              <svg className="w-12 h-12 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full border-2 border-boon-blue/30 animate-ping" />
            </div>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 text-sm text-boon-blue bg-boon-lightBlue px-4 py-2 rounded-full mb-6">
              <div className="w-2 h-2 bg-boon-blue rounded-full animate-pulse" />
              Matching in progress
            </div>

            {/* Text */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-boon-text mb-4">
              Finding your perfect coach
            </h1>
            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
              Thanks for completing your welcome survey! We're carefully matching you with a coach who fits your goals, preferences, and style.
            </p>

            {/* What's happening */}
            <div className="bg-boon-bg rounded-2xl p-6 mb-8 text-left">
              <p className="text-sm font-bold text-boon-text mb-4">What's happening:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-600">Your preferences have been recorded</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-boon-lightBlue flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-boon-blue rounded-full animate-pulse" />
                  </div>
                  <span className="text-gray-600">Reviewing coaches who match your goals</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-gray-300 rounded-full" />
                  </div>
                  <span className="text-gray-400">You'll receive an email when matched</span>
                </li>
              </ul>
            </div>

            {/* Timeline */}
            <div className="bg-gradient-to-r from-boon-blue/5 to-boon-lightBlue/30 rounded-2xl p-6 text-center">
              <p className="text-sm text-gray-600">
                Most people are matched within <span className="font-bold text-boon-text">24-48 hours</span>
              </p>
            </div>
          </div>

          {/* Support link */}
          <p className="text-center text-sm text-gray-400 mt-8">
            Questions? Email{' '}
            <a href="mailto:support@boon-health.com" className="text-boon-blue hover:underline">
              support@boon-health.com
            </a>
          </p>

          {/* Sign out link */}
          <p className="text-center text-sm text-gray-400 mt-4">
            Signed in as {employee?.company_email || 'unknown'}.{' '}
            <button onClick={signOut} className="text-boon-blue hover:underline">
              Sign out
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
