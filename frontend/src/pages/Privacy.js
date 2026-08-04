import Header from "../components/Header";

const Section = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="font-display text-2xl sm:text-3xl uppercase font-bold tracking-tight border-b border-white/10 pb-3 mb-4">
      {title}
    </h2>
    <div className="text-neutral-300 leading-relaxed space-y-3">{children}</div>
  </div>
);

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs tracking-[0.2em] uppercase font-bold text-neutral-400 mb-4">
          Legal
        </div>
        <h1 className="font-display text-5xl sm:text-6xl uppercase font-black tracking-tighter mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-neutral-500 mb-12">Last updated: August 4, 2026</p>

        <p className="text-neutral-300 mb-10">
          This Privacy Policy explains how <strong className="text-white">The Court</strong> ("the App", "we", "us")
          collects, uses, and protects your information when you use our badminton court booking service, available
          on the web and as an Android application.
        </p>

        <Section title="1. Who Runs This App">
          <p>
            The Court is developed and maintained by <strong className="text-white">Sankeerth Nara</strong>. For any
            privacy-related questions, requests, or concerns, reach out using the contact details at the bottom of
            this page.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <p>To provide court booking and membership services, we collect:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Account information</strong> — name and phone number, used to create your account and verify identity via OTP.</li>
            <li><strong className="text-white">Booking data</strong> — selected slots, dates, and booking history, used to reserve courts and prevent double-booking.</li>
            <li><strong className="text-white">Payment information</strong> — transaction records and payment status, processed by Razorpay, used to collect security deposits and monthly fees.</li>
            <li><strong className="text-white">Device information</strong> — basic device and app version data, used to keep the app working correctly.</li>
          </ul>
          <p>
            <strong className="text-white">We do not collect or store your full payment card, UPI, or bank details.</strong> Those are handled entirely by Razorpay.
          </p>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-2">
            <li>To register and authenticate your account</li>
            <li>To process court bookings, security deposits, and monthly membership fees</li>
            <li>To show your booking history and availability</li>
            <li>To notify you about booking confirmations, holidays, or slot changes</li>
            <li>To maintain the security and integrity of the booking system</li>
          </ul>
        </Section>

        <Section title="4. How We Share Your Information">
          <p>We do not sell or rent your personal information. We share data only with:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Razorpay</strong> — to process deposits and fee payments securely.</li>
            <li><strong className="text-white">Colony administrators</strong> — booking and payment status may be visible to designated admins to manage court access and resolve disputes.</li>
          </ul>
          <p>We do not share your data with advertisers or third-party marketers.</p>
        </Section>

        <Section title="5. Data Storage & Security">
          <p>
            Your data is stored on secured cloud infrastructure and accessed over encrypted HTTPS connections.
            Passwords and sensitive credentials are hashed and never stored in plain text. Admin functions are
            restricted and authenticated via JWT-based sessions.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your account and booking data for as long as your account remains active, and for a
            reasonable period afterward to resolve disputes, maintain financial records, and comply with applicable
            regulations. You may request deletion of your account and associated data at any time.
          </p>
        </Section>

        <Section title="7. Children's Privacy">
          <p>
            The Court is not directed at children under 13. We do not knowingly collect personal information from
            children under 13. If you believe a child has provided us with personal information, contact us and we
            will remove it.
          </p>
        </Section>

        <Section title="8. Your Rights">
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for data processing, subject to service limitations this may cause</li>
          </ul>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. The "Last updated" date above will always reflect
            the most recent version. Continued use of the App after changes are posted means you accept the updated
            policy.
          </p>
        </Section>

        <Section title="10. Contact Us">
          <div className="bg-[#171717] border border-white/10 border-l-2 border-l-[#FF3B30] rounded-md p-6">
            <div className="text-[11px] tracking-[0.15em] uppercase font-bold text-[#FF3B30] mb-2">
              Get in touch
            </div>
            <p className="m-0 mb-1">Developer: <strong className="text-white">Sankeerth Nara</strong></p>
            <p className="m-0">
              Email:{" "}
              <a href="mailto:sankeerthnara@gmail.com" className="text-[#FF3B30] hover:text-[#FF564E]">
                sankeerthnara@gmail.com
              </a>
            </p>
          </div>
        </Section>
      </main>
    </div>
  );
}
