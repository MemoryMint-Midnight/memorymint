export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-5xl font-bold mb-2 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
        Terms of Service
      </h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: February 2026</p>

      <div className="bg-white rounded-2xl p-8 shadow-lg space-y-10 text-gray-600 leading-relaxed">

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>1. About Memory Mint</h2>
          <p>
            Memory Mint (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a digital keepsake platform that lets users preserve photos, videos, and personal notes as permanent records on the Cardano blockchain. By accessing or using Memory Mint you agree to be bound by these Terms of Service. If you do not agree, please do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>2. Eligibility</h2>
          <p>
            You must be at least 18 years old to use Memory Mint. By creating an account you confirm that you meet this requirement. If you are under 18, a parent or guardian must create the account on your behalf and take full responsibility for its use.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>3. Accounts and Security</h2>
          <p className="mb-3">
            You may register using an email address or a compatible Cardano wallet. You are responsible for maintaining the security of your account credentials, wallet, and seed phrase. Memory Mint cannot recover lost seed phrases or access private custodial wallets once the seed phrase has been dismissed.
          </p>
          <p>
            You must notify us immediately at <a href="mailto:support@memorymint.io" className="text-amber-600 hover:underline">support@memorymint.io</a> if you suspect unauthorised access to your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>4. Your Content</h2>
          <p className="mb-3">
            You retain full ownership of any content you upload to Memory Mint. By uploading content you grant Memory Mint a limited, non-exclusive licence to store, process, and display that content solely for the purpose of providing the service to you.
          </p>
          <p className="mb-3">You must not upload content that:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Infringes any third party&apos;s intellectual property or privacy rights</li>
            <li>Contains illegal material, including child sexual abuse material (CSAM)</li>
            <li>Is defamatory, harassing, or threatening toward any person</li>
            <li>Violates any applicable law or regulation</li>
          </ul>
          <p className="mt-3">
            We reserve the right to remove content that violates these terms and to suspend or terminate accounts responsible for repeated violations.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>5. Blockchain Permanence</h2>
          <p>
            Once a keepsake is minted to the Cardano blockchain, the on-chain record is <strong>permanent and cannot be altered or deleted</strong> — not by you, not by Memory Mint, not by anyone. This is a fundamental property of blockchain technology and the core value of the service. Please review your content carefully before minting.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>6. Pricing and Payments</h2>
          <p className="mb-3">Current service fees are:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Single keepsake mint: $2.50 USD (or ADA equivalent at time of minting)</li>
            <li>Batch of 5 same-type keepsakes minted together: $10.00 USD flat</li>
            <li>Video keepsakes: $5.00 USD per keepsake ($20.00 per batch of 5)</li>
          </ul>
          <p className="mt-3 mb-3">
            All fees are converted to ADA at the live exchange rate at the time you confirm the transaction. A Cardano network fee (typically 0.17–0.25 ADA) is also charged by the blockchain network itself — this goes entirely to network validators, not to Memory Mint.
          </p>
          <p>
            <strong>No refunds.</strong> Because blockchain transactions are irreversible and the minting process begins immediately upon confirmation, all sales are final. If a transaction fails before the on-chain record is created, the ADA will be returned to your wallet by the Cardano network protocol. If you experience a technical issue, please contact us at <a href="mailto:support@memorymint.io" className="text-amber-600 hover:underline">support@memorymint.io</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>7. Privacy Settings</h2>
          <p>
            You choose the privacy level of each keepsake at the time of minting — Public, Shared (invite-only), or Private (Midnight, coming soon). Public keepsakes are visible to anyone. Shared keepsakes are accessible only via your unique share link. You are responsible for deciding who you share links with; Memory Mint cannot revoke access to links that have already been distributed.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>8. Service Availability</h2>
          <p>
            We aim to keep Memory Mint available at all times but do not guarantee uninterrupted service. We may perform maintenance, updates, or changes at any time. We are not liable for any loss or inconvenience caused by downtime. Blockchain transactions depend on the Cardano network, which is operated independently of Memory Mint.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>9. Intellectual Property</h2>
          <p>
            All software, design, branding, and non-user content on Memory Mint is owned by or licensed to us and protected by copyright and other intellectual property laws. You may not copy, reproduce, or distribute any part of the platform without our prior written consent.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>10. Disclaimer of Warranties</h2>
          <p>
            Memory Mint is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. We do not warrant that the service will be error-free, that defects will be corrected, or that the service or the servers that make it available are free of viruses or other harmful components. Your use of the service is entirely at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>11. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, Memory Mint and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of profits, data, or goodwill — arising from your use of or inability to use the service. Our total liability to you for any claim shall not exceed the amount you paid us in the 30 days preceding the event giving rise to the claim.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>12. Account Suspension and Termination</h2>
          <p>
            We may suspend or terminate your account at our discretion if you violate these terms, engage in fraudulent activity, or create legal or reputational risk for the platform. You may delete your account at any time via your account page. Deletion removes your account data from our systems; it does not and cannot remove on-chain records, which are permanent by design.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>13. Changes to These Terms</h2>
          <p>
            We may update these terms from time to time. We will notify registered users of material changes by email or via a notice on the platform. Continued use of Memory Mint after changes take effect constitutes your acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>14. Governing Law</h2>
          <p>
            These terms are governed by and construed in accordance with the laws of the jurisdiction in which Memory Mint operates. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts of that jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>15. Contact</h2>
          <p>
            If you have questions about these terms, please contact us at{' '}
            <a href="mailto:support@memorymint.io" className="text-amber-600 hover:underline">
              support@memorymint.io
            </a>.
          </p>
        </section>

      </div>
    </div>
  )
}
