export const metadata = {
  title: 'Support — Vitra',
  description: 'Get help with Vitra — nutrition tracking, food logging, and health insights.',
};

export default function Support() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#1a1a1a', lineHeight: 1.7 }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>Vitra Support</h1>
        <p style={{ color: '#666', fontSize: 18 }}>We're here to help.</p>
      </div>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '24px 28px', marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#15803d', marginBottom: 8 }}>📧 Contact Support</h2>
        <p style={{ margin: 0 }}>Email us at <a href="mailto:support@vitra.app" style={{ color: '#16a34a', fontWeight: 600 }}>support@vitra.app</a> — we respond within 24 hours.</p>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>Frequently Asked Questions</h2>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>How do I log a meal?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>Tap the "Log Food" tab at the bottom of the screen. Search for a food by name, scan a barcode, or use AI Scan to photograph your meal. Select the food, adjust the serving size, and tap "Add to [meal type]".</p>
      </details>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>How is my calorie target calculated?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>Your target is calculated using the Mifflin-St Jeor equation based on your age, sex, height, weight, and activity level, then adjusted for your goal (lose weight, maintain, or gain). You can override it manually in Settings → Edit Profile → Macro Targets.</p>
      </details>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>How do I delete a food entry?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>On the Food Log page, swipe left on any meal item to reveal the delete button. On the Dashboard, you can also swipe left on items in your meal list.</p>
      </details>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>Why isn't the AI meal scan accurate?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>AI meal scanning uses computer vision to estimate foods and portions. For best results: photograph from directly above, ensure good lighting, and include a reference object for scale. You can always adjust the serving count after the scan.</p>
      </details>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>How do I cancel my Pro subscription?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>Go to Settings → Subscription → Manage Subscription. This will open Stripe's customer portal where you can cancel anytime. If you subscribed through the App Store, manage it in iPhone Settings → [Your Name] → Subscriptions.</p>
      </details>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>How do I delete my account?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>Go to Settings → Account → Delete Account. This permanently deletes all your data including meal history, profile, and bloodwork records. This action cannot be undone.</p>
      </details>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>I forgot my password — what do I do?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>On the login screen, tap "Continue with Email", then tap "Forgot password?". Enter your email and we'll send a reset link. Check your spam folder if it doesn't arrive within a few minutes.</p>
      </details>

      <details style={{ marginBottom: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
        <summary style={{ fontWeight: 600, fontSize: 16 }}>Is my health data private?</summary>
        <p style={{ marginTop: 12, marginBottom: 0 }}>Yes. Your health data is stored securely and never sold to third parties, advertisers, or insurance companies. See our <a href="/privacy" style={{ color: '#16a34a' }}>Privacy Policy</a> for full details.</p>
      </details>

      <div style={{ marginTop: 48, padding: '24px 28px', background: '#f9fafb', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ margin: 0, color: '#666' }}>Still need help? Email <a href="mailto:support@vitra.app" style={{ color: '#16a34a', fontWeight: 600 }}>support@vitra.app</a></p>
      </div>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <a href="/privacy" style={{ color: '#16a34a', marginRight: 24 }}>Privacy Policy</a>
        <a href="/terms" style={{ color: '#16a34a' }}>Terms of Service</a>
      </div>

      <p style={{ marginTop: 32, color: '#999', fontSize: 14, textAlign: 'center' }}>© 2026 Vitra. All rights reserved.</p>
    </main>
  );
}
