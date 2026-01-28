export default function WelcomeCompletePage() {
  return (
    <div className="min-h-screen bg-boon-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <img
            src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Wordmark_Blue_16_aw7lvc.png"
            alt="Boon Health"
            className="h-9 max-w-[160px] object-contain mx-auto mb-8"
          />
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎉</span>
          </div>

          <h1 className="text-2xl font-black text-boon-text mb-4">
            You're all set!
          </h1>

          <p className="text-gray-500 mb-8 leading-relaxed">
            We'll send your coach matches to Slack as soon as they're ready. Keep an eye out for a message from Boon Coach.
          </p>

          <a
            href="/login"
            className="block w-full py-4 bg-boon-blue text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-boon-darkBlue transition-all shadow-lg shadow-boon-blue/20 active:scale-[0.98] text-center"
          >
            Log in to your portal
          </a>

          <a
            href="https://www.boon-health.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 text-boon-blue font-bold text-sm hover:underline"
          >
            Learn more about Boon
          </a>
        </div>
      </div>
    </div>
  );
}
