export const metadata = {
  title: 'Privacy Policy — Vitra',
  description: 'How Vitra collects, uses, and protects your personal and health data.',
};

export default function PrivacyPolicy() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#1a1a1a', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>Last updated: June 7, 2026</p>

      <p>Vitra ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Vitra mobile application and related services.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>1. Information We Collect</h2>
      <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Information you provide directly</h3>
      <ul>
        <li>Account information: name, email address, password</li>
        <li>Profile data: date of birth, sex, height, weight, activity level, dietary preferences</li>
        <li>Health & nutrition data: food logs, meal history, water intake, bloodwork markers</li>
        <li>Weight entries and progress data</li>
        <li>Custom foods you create</li>
      </ul>

      <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Information collected automatically</h3>
      <ul>
        <li>App usage data (features used, screens visited)</li>
        <li>Device type, operating system version</li>
        <li>Crash reports and performance diagnostics</li>
      </ul>

      <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Camera and Photos</h3>
      <p>If you use the AI meal scan feature, images are captured temporarily to identify foods and estimate portions. Images are sent to OpenAI's API for processing and are <strong>not stored</strong> on our servers after analysis.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>2. How We Use Your Information</h2>
      <ul>
        <li>To provide and personalise the Vitra service</li>
        <li>To calculate your caloric and macro targets based on your profile</li>
        <li>To generate AI-powered nutrition insights using OpenAI's API</li>
        <li>To send password reset emails via Resend</li>
        <li>To process subscription payments via Stripe</li>
        <li>To improve our app and fix bugs</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>3. Third-Party Services</h2>
      <p>We use the following third-party services that may process your data:</p>
      <ul>
        <li><strong>OpenAI</strong> — powers AI nutrition insights and meal photo analysis. <a href="https://openai.com/privacy" style={{ color: '#16a34a' }}>Privacy Policy</a></li>
        <li><strong>Stripe</strong> — processes subscription payments. Your payment information is handled entirely by Stripe and never stored on our servers. <a href="https://stripe.com/privacy" style={{ color: '#16a34a' }}>Privacy Policy</a></li>
        <li><strong>Resend</strong> — sends transactional emails (password resets). <a href="https://resend.com/legal/privacy-policy" style={{ color: '#16a34a' }}>Privacy Policy</a></li>
        <li><strong>Railway</strong> — hosts our backend and database on servers in the United States. <a href="https://railway.app/legal/privacy" style={{ color: '#16a34a' }}>Privacy Policy</a></li>
        <li><strong>USDA FoodData Central</strong> — provides our food nutrition database (public data, no personal info shared)</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>4. Data Storage & Security</h2>
      <p>Your data is stored in a secure PostgreSQL database hosted on Railway (United States). We use industry-standard encryption for data in transit (HTTPS/TLS) and at rest. Passwords are hashed using bcrypt and never stored in plain text.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>5. Health Data</h2>
      <p>Vitra collects health-related data including food intake, weight, and bloodwork markers. This data is used solely to provide the Vitra service and is never sold to third parties. We do not share your health data with insurance companies, employers, or advertisers.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> your data — all your data is visible within the app</li>
        <li><strong>Export</strong> your nutrition history — available in Settings</li>
        <li><strong>Delete</strong> your account and all associated data — available in Settings → Account → Delete Account</li>
        <li><strong>Correct</strong> inaccurate data — edit your profile at any time in Settings</li>
      </ul>
      <p>For GDPR requests or any privacy concern, contact us at <a href="mailto:privacy@vitra.app" style={{ color: '#16a34a' }}>privacy@vitra.app</a>.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>7. Children's Privacy</h2>
      <p>Vitra is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us immediately.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>8. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the date at the top of this page. Continued use of Vitra after changes constitutes acceptance of the updated policy.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>9. Contact Us</h2>
      <p>If you have questions about this Privacy Policy, contact us at:<br />
      <a href="mailto:privacy@vitra.app" style={{ color: '#16a34a' }}>privacy@vitra.app</a></p>

      <p style={{ marginTop: 48, color: '#999', fontSize: 14 }}>© 2026 Vitra. All rights reserved.</p>
    </main>
  );
}
