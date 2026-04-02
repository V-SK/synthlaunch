export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-[#F0B90B] mb-6">Privacy Policy</h1>
      <p className="text-gray-400 mb-4">Last updated: February 7, 2026</p>
      
      <div className="space-y-6 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">1. Information We Collect</h2>
          <p>We collect wallet addresses for transaction processing. When using Twitter OAuth, we access your Twitter handle for identity verification.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">2. How We Use Information</h2>
          <p>Wallet addresses are used to process token launches and fee claims. Twitter handles are used to verify token ownership for the claim process.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">3. Blockchain Data</h2>
          <p>All transactions are recorded on BNB Chain and are publicly visible. We do not control blockchain data.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">4. Third Party Services</h2>
          <p>We integrate with OKX Onchain OS for token deployment and Twitter for OAuth. These services have their own privacy policies.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">5. Data Security</h2>
          <p>We do not store private keys. Wallet connections are handled client-side through your wallet provider.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">6. Contact</h2>
          <p>For privacy concerns, reach us on Twitter: <a href="https://x.com/synth_fun" className="text-[#F0B90B] hover:underline">@synth_fun</a></p>
        </section>
      </div>
    </main>
  );
}
