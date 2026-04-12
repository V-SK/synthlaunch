export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-synth-green mb-2 font-mono">SYNTH Wallet Privacy Policy</h1>
      <p className="text-gray-400 mb-8">Effective date: April 12, 2026</p>

      <div className="space-y-8 text-gray-300 leading-relaxed">
        <p>
          SYNTH Wallet (&quot;SYNTH Wallet&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy. This Privacy Policy explains how SYNTH Wallet handles information when you use the mobile application.
        </p>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">1. Overview</h2>
          <p>
            SYNTH Wallet is a non-custodial mobile wallet. We do not take custody of user assets, and we do not store your private keys or recovery phrase on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">2. Information We Collect</h2>
          <p className="mb-2">
            SYNTH Wallet is designed to minimize data collection.
          </p>
          <p className="mb-2">We may process the following categories of information on your device:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Wallet addresses</li>
            <li>Encrypted wallet data stored locally on your device</li>
            <li>App preferences and settings</li>
            <li>Transaction-related information necessary to display balances, wallet activity, token holdings, and blockchain interactions</li>
          </ul>
          <p className="mt-2">
            We do not intentionally collect or store your private keys or recovery phrase on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">3. Blockchain Data</h2>
          <p className="mb-2">
            Because SYNTH Wallet interacts with public blockchain networks, certain information may be publicly visible on the blockchain, including:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Wallet addresses</li>
            <li>Transaction hashes</li>
            <li>Transaction amounts</li>
            <li>Public balances, token holdings, and activity</li>
          </ul>
          <p className="mt-2">Blockchain data is public by nature and is not controlled by SYNTH Wallet.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">4. How Information Is Used</h2>
          <p className="mb-2">Information processed by the app may be used to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Create, import, and manage wallets</li>
            <li>Display balances, staking information, and transaction history</li>
            <li>Broadcast transactions to supported blockchain networks</li>
            <li>Improve app functionality, security, and reliability</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">5. Local Storage and Security</h2>
          <p className="mb-2">
            Sensitive wallet-related data is stored locally on your device using available platform security mechanisms. You are responsible for maintaining the security of your device, app password, and recovery phrase.
          </p>
          <p>
            If you lose your recovery phrase, we may not be able to restore access to your wallet.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">6. Third-Party Services</h2>
          <p>
            SYNTH Wallet may communicate with blockchain infrastructure providers, remote procedure call (RPC) endpoints, and related network services in order to read balances, retrieve blockchain data, and submit transactions.
          </p>
          <p className="mt-2">
            These third-party services may receive technical information such as IP address, device networking metadata, and blockchain requests as part of normal network operation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">7. Data Sharing</h2>
          <p className="mb-2">We do not sell your personal information.</p>
          <p>
            We may share limited technical data only when necessary to operate the app, comply with law, protect rights, or respond to valid legal requests.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">8. Data Retention</h2>
          <p className="mb-2">
            Data stored locally on your device remains under your control unless deleted by you or removed when the app is uninstalled.
          </p>
          <p>Public blockchain records may remain permanently available on the relevant network.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">9. Children&apos;s Privacy</h2>
          <p>
            SYNTH Wallet is not directed to children under the age of 13, and we do not knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">10. International Use</h2>
          <p>
            The app may be accessed in different jurisdictions. By using SYNTH Wallet, you understand that blockchain transactions and supporting network activity may involve international data transmission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">11. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Updated versions will be posted at the applicable privacy policy URL.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">12. Contact</h2>
          <p>
            If you have questions about this Privacy Policy, please contact:
          </p>
          <div className="mt-2 font-mono text-sm">
            <p>SYNTH</p>
            <p>Website: <a href="https://synthlaunch.fun" className="text-synth-green hover:underline">synthlaunch.fun</a></p>
            <p>Twitter: <a href="https://twitter.com/synth_fun" className="text-synth-green hover:underline">@synth_fun</a></p>
          </div>
        </section>
      </div>
    </main>
  );
}
