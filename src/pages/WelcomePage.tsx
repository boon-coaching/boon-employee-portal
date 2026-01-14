import { useAuth } from '../lib/AuthContext';

interface WelcomePageProps {
  welcomeSurveyUrl?: string;
}

export default function WelcomePage({ welcomeSurveyUrl }: WelcomePageProps) {
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
          {/* Welcome Card */}
          <div className="bg-white rounded-[2.5rem] p-10 md:p-12 shadow-sm border border-gray-100 text-center">
            {/* Icon */}
            <div className="w-24 h-24 bg-gradient-to-br from-boon-lightBlue to-boon-blue/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            {/* Welcome Text */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-boon-text mb-4">
              Welcome{employee?.first_name ? `, ${employee.first_name}` : ''}!
            </h1>
            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
              You're about to start a transformative coaching journey. Let's begin with a quick survey to understand your goals and match you with the perfect coach.
            </p>

            {/* Benefits */}
            <div className="bg-boon-bg rounded-2xl p-6 mb-8 text-left">
              <p className="text-sm font-bold text-boon-text mb-4">What you'll get:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-boon-lightBlue flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-600">A coach matched to your unique goals and style</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-boon-lightBlue flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-600">Personalized 1:1 coaching sessions</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-boon-lightBlue flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-600">Tools and support for your professional growth</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <a
              href={welcomeSurveyUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-boon-blue text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-boon-darkBlue transition-all shadow-lg shadow-boon-blue/20 active:scale-[0.98]"
            >
              Start Welcome Survey
            </a>
            <p className="text-xs text-gray-400 mt-4">Takes about 5 minutes</p>
          </div>

          {/* Sign out link */}
          <p className="text-center text-sm text-gray-400 mt-8">
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
