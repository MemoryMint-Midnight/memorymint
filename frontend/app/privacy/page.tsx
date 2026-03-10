export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-5xl font-bold mb-2 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
        Privacy Policy
      </h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: February 2026</p>

      <div className="bg-white rounded-2xl p-8 shadow-lg space-y-10 text-gray-600 leading-relaxed">

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>1. Who We Are</h2>
          <p>
            Memory Mint (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a digital keepsake platform that preserves personal memories on the Cardano blockchain. This policy explains what personal data we collect, how we use it, and your rights over it.
          </p>
          <p className="mt-3">
            For privacy enquiries, please contact us at{' '}
            <a href="mailto:support@memorymint.io" className="text-amber-600 hover:underline">support@memorymint.io</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>2. Data We Collect</h2>
          <p className="mb-3">We collect only what is necessary to provide the service:</p>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Account data</h3>
              <p>Your email address (if you register with email), or your Cardano wallet address (if you connect a wallet). We also store a derived username and the date your account was created.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Custodial wallet data (email users only)</h3>
              <p>For email-registered users we generate and temporarily store an encrypted Cardano wallet seed phrase on your behalf. This is deleted permanently from our servers as soon as you confirm you have backed it up. After backup confirmation we hold only your wallet&apos;s public payment address — we never retain the private key.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Uploaded content</h3>
              <p>Photos, videos, audio files, titles, and descriptions you upload when creating keepsakes. These are stored on our server and referenced on the blockchain.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Blockchain data</h3>
              <p>Transaction hashes, policy IDs, and on-chain metadata associated with your minted keepsakes. This data is public by nature of the Cardano blockchain and cannot be deleted.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Usage data</h3>
              <p>Standard server logs including IP addresses, request times, and browser information. These are used for security, debugging, and service improvement, and are not sold or shared with third parties.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>3. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>To create and manage your account</li>
            <li>To process keepsake minting transactions on the Cardano blockchain</li>
            <li>To send you one-time verification codes for email login</li>
            <li>To respond to your support requests</li>
            <li>To detect and prevent fraud, abuse, and security incidents</li>
            <li>To comply with our legal obligations</li>
          </ul>
          <p className="mt-3">
            We do not use your data for advertising, we do not build behavioural profiles, and we do not sell your data to any third party.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>4. Lawful Basis for Processing (GDPR)</h2>
          <p className="mb-3">If you are located in the European Economic Area (EEA) or United Kingdom, our lawful basis for processing your personal data is:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Contract performance</strong> — processing necessary to provide the service you signed up for</li>
            <li><strong>Legitimate interests</strong> — security monitoring, fraud prevention, and service improvement</li>
            <li><strong>Legal obligation</strong> — where we are required to retain or disclose data by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>5. Third-Party Services</h2>
          <p className="mb-3">We use the following third-party services to operate Memory Mint:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Cardano network</strong> — a public, decentralised blockchain. Data written to the blockchain is permanent and publicly accessible by design.</li>
            <li><strong>Anvil (ada-anvil.io)</strong> — a Cardano transaction-building API used to construct and submit mint transactions. File content and personal details are not shared with Anvil.</li>
            <li><strong>Web hosting provider</strong> — our backend runs on a managed server. Your data is stored on that server in accordance with the provider&apos;s security standards.</li>
          </ul>
          <p className="mt-3">We do not use advertising networks, analytics trackers, or social media pixels.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>6. Data Retention</h2>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Account data</strong> — retained for as long as your account is active, plus up to 90 days after deletion to allow for dispute resolution</li>
            <li><strong>Custodial wallet seed phrase</strong> — deleted immediately and permanently when you confirm backup</li>
            <li><strong>Uploaded media files</strong> — retained for as long as your account is active; deleted when you delete your account</li>
            <li><strong>Blockchain records</strong> — permanent; cannot be deleted by anyone</li>
            <li><strong>Server logs</strong> — retained for up to 30 days for security purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>7. Your Rights</h2>
          <p className="mb-3">Depending on your location, you may have the following rights regarding your personal data:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Access</strong> — request a copy of the data we hold about you (use &ldquo;Download my data&rdquo; on your account page, or contact us)</li>
            <li><strong>Rectification</strong> — ask us to correct inaccurate data</li>
            <li><strong>Erasure</strong> — request deletion of your account and associated data. Note: on-chain blockchain records cannot be erased as they are not under our control.</li>
            <li><strong>Portability</strong> — receive your data in a machine-readable format (JSON export available on your account page)</li>
            <li><strong>Restriction</strong> — ask us to restrict processing of your data in certain circumstances</li>
            <li><strong>Objection</strong> — object to processing based on our legitimate interests</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:support@memorymint.io" className="text-amber-600 hover:underline">support@memorymint.io</a>.
            We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>8. Cookies</h2>
          <p>
            Memory Mint does not use advertising or tracking cookies. We use a single session-based authentication mechanism stored in your browser&apos;s <code className="bg-gray-100 px-1 rounded">sessionStorage</code>, which is cleared automatically when you close your browser tab. No persistent tracking cookies are set.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>9. Data Security</h2>
          <p>
            We implement appropriate technical and organisational measures to protect your data against unauthorised access, alteration, disclosure, or destruction. These include encrypted storage of sensitive wallet data, hashed authentication tokens, rate-limited login endpoints, and HTTPS-only communication. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>10. Children&apos;s Privacy</h2>
          <p>
            Memory Mint is not directed at children under 18. We do not knowingly collect personal data from anyone under 18. If you believe a child has provided us with personal data without parental consent, please contact us and we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>11. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify registered users of material changes by email. The &ldquo;last updated&rdquo; date at the top of this page reflects the most recent revision. Continued use of Memory Mint after changes take effect constitutes your acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>12. Contact</h2>
          <p>
            For any privacy-related questions or to exercise your data rights, please contact us at{' '}
            <a href="mailto:support@memorymint.io" className="text-amber-600 hover:underline">
              support@memorymint.io
            </a>.
          </p>
        </section>

      </div>
    </div>
  )
}
