export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-[#F0B90B] mb-6">Terms of Service</h1>
      <p className="text-gray-400 mb-4">Last updated: February 7, 2026</p>
      
      <div className="space-y-6 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
          <p>By accessing SynthLaunch, you agree to these terms. SynthLaunch is a token launchpad on BNB Chain.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">2. Service Description</h2>
          <p>SynthLaunch provides infrastructure for launching tokens via the Flap protocol. We do not provide financial advice.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">3. User Responsibilities</h2>
          <p>Users are responsible for their own wallet security and transaction decisions. All blockchain transactions are irreversible.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">4. Fees</h2>
          <p>Platform fees are disclosed at the time of transaction. Tax token creators receive 80% of tax revenue; 20% goes to the platform.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">5. Disclaimer</h2>
          <p>SynthLaunch is provided &quot;as is&quot; without warranties. Cryptocurrency investments carry risk. DYOR.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">6. Contact</h2>
          <p>For questions, reach us on Twitter: <a href="https://x.com/synth_fun" className="text-[#F0B90B] hover:underline">@synth_fun</a></p>
        </section>
      </div>
    </main>
  );
}
