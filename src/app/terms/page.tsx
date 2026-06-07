export const metadata = {
  title: 'Terms of Service — Vitra',
  description: 'Terms and conditions for using the Vitra health and nutrition app.',
};

export default function TermsOfService() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#1a1a1a', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>Last updated: June 7, 2026</p>

      <p>Please read these Terms of Service ("Terms") carefully before using the Vitra mobile application. By accessing or using Vitra, you agree to be bound by these Terms.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>1. Acceptance of Terms</h2>
      <p>By creating an account or using Vitra, you confirm that you are at least 13 years old and agree to these Terms. If you are under 18, you must have parental consent.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>2. Description of Service</h2>
      <p>Vitra is a personal health and nutrition tracking application that provides:</p>
      <ul>
        <li>Food and calorie logging with a nutrition database</li>
        <li>AI-powered nutrition insights and meal analysis</li>
        <li>Weight and progress tracking</li>
        <li>Bloodwork marker logging</li>
        <li>Personalised macro and caloric targets</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>3. Medical Disclaimer</h2>
      <p><strong>Vitra is not a medical device and does not provide medical advice.</strong> The information provided by Vitra, including AI-generated insights, is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment.</p>
      <p>Always consult a qualified healthcare provider before making significant changes to your diet, exercise routine, or health management, especially if you have a medical condition.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>4. User Accounts</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your account credentials</li>
        <li>You are responsible for all activity that occurs under your account</li>
        <li>You must provide accurate and current information when creating your account</li>
        <li>You may not share your account with others</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>5. Subscriptions and Payments</h2>
      <p>Vitra offers a free tier and a paid Pro subscription. By subscribing to Vitra Pro:</p>
      <ul>
        <li>You authorise us to charge your payment method on a recurring basis</li>
        <li>Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date</li>
        <li>Refunds are handled in accordance with Apple App Store or Google Play policies</li>
        <li>You can manage or cancel your subscription at any time in Settings → Subscription</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>6. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use Vitra for any unlawful purpose</li>
        <li>Attempt to reverse-engineer, hack, or disrupt the service</li>
        <li>Upload malicious content or attempt to compromise our systems</li>
        <li>Scrape or bulk-download our food database</li>
        <li>Create multiple accounts to circumvent limits</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>7. Intellectual Property</h2>
      <p>Vitra and its content, features, and functionality are owned by us and are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, or distribute any part of Vitra without our express written permission.</p>
      <p>You retain ownership of the personal data you input into Vitra.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>8. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law, Vitra and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service, including but not limited to health outcomes based on information provided by the app.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>9. Termination</h2>
      <p>We reserve the right to suspend or terminate your account at our discretion if you violate these Terms. You may delete your account at any time in Settings → Account → Delete Account.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>10. Changes to Terms</h2>
      <p>We may modify these Terms at any time. We will notify you of material changes through the app or via email. Continued use of Vitra after changes constitutes acceptance.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>11. Governing Law</h2>
      <p>These Terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through binding arbitration.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>12. Contact</h2>
      <p>Questions about these Terms? Contact us at:<br />
      <a href="mailto:legal@vitra.app" style={{ color: '#16a34a' }}>legal@vitra.app</a></p>

      <p style={{ marginTop: 48, color: '#999', fontSize: 14 }}>© 2026 Vitra. All rights reserved.</p>
    </main>
  );
}
