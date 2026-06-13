import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { useConfig } from "@/contexts/ConfigContext";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useSiteData } from "@/hooks/useSiteData";

export default function PrivacyPolicy() {
  const { org } = useConfig();
  const { data } = useSiteData();
  const s = data?.settings || {};
  const donation = s.donation || {};
  const donateLink = donation.paymentLink || s.hero?.ctaLink;

  const orgName = org.displayName || org.erpTitle || "People's Foundation";
  const email = org.email || "info@peoplefoundation.org";
  const phone = org.phone || "";
  const address = org.address || "";
  const website = org.website || org.websiteUrl || "";
  const lastUpdated = "June 2026";

  useEffect(() => {
    window.scrollTo(0, 0);
    const prev = document.title;
    document.title = `Privacy Policy — ${orgName}`;
    return () => {
      document.title = prev;
    };
  }, [orgName]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader donateLink={donateLink} />

      {/* Hero */}
      <section className="border-b border-border/40 bg-gradient-hero py-16 text-center text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold md:text-4xl">Privacy Policy</h1>
          <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/90">
            How {orgName} collects, uses, and protects your personal information.
          </p>
          <p className="mt-2 text-sm text-primary-foreground/70">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-14">
        <div className="container mx-auto max-w-3xl space-y-8 px-4 leading-relaxed text-muted-foreground">
          <div className="space-y-3">
            <p>
              {orgName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to
              protecting the privacy of beneficiaries, donors, volunteers, and visitors. This Privacy
              Policy explains what information we collect through our website and applications, how we
              use it, and the choices you have. By using our services, you agree to the practices
              described below.
            </p>
          </div>

          <PolicySection title="1. Information We Collect">
            <p>We may collect the following categories of information:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Personal details</strong> — name, date of birth, gender, photograph, and
                government identification provided when you register or apply for assistance.
              </li>
              <li>
                <strong>Contact information</strong> — phone number, email address, and postal
                address.
              </li>
              <li>
                <strong>Application data</strong> — details about your household, income, needs, and
                supporting documents submitted for welfare schemes.
              </li>
              <li>
                <strong>Donation information</strong> — amount, payment reference, and contact details
                for donors (we do not store full card or banking credentials).
              </li>
              <li>
                <strong>Technical data</strong> — device type, browser, and usage information
                collected automatically to keep the service secure and reliable.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="2. How We Use Your Information">
            <ul className="ml-5 list-disc space-y-2">
              <li>To verify eligibility and process applications for welfare schemes.</li>
              <li>To disburse and track assistance, payments, and follow-ups.</li>
              <li>To communicate updates about your application, programs, and events.</li>
              <li>To acknowledge donations and issue receipts to donors.</li>
              <li>To improve our programs, services, and the security of our platform.</li>
              <li>To comply with legal, regulatory, and audit requirements.</li>
            </ul>
          </PolicySection>

          <PolicySection title="3. Legal Basis & Consent">
            <p>
              We process your information based on your consent, to fulfil our charitable obligations
              to you, and to comply with applicable laws. You may withdraw consent at any time by
              contacting us, subject to records we are required to retain by law.
            </p>
          </PolicySection>

          <PolicySection title="4. How We Share Information">
            <p>We do not sell your personal information. We may share it only with:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                Authorized administrators, committees, and field volunteers of {orgName} involved in
                verifying and approving assistance.
              </li>
              <li>
                Trusted service providers (such as payment and communication partners) who act on our
                behalf under confidentiality obligations.
              </li>
              <li>
                Government or regulatory authorities when required by law or to prevent fraud and
                misuse.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="5. Data Security">
            <p>
              We apply reasonable administrative, technical, and physical safeguards — including
              access controls, encryption in transit, and audit logging — to protect your information.
              However, no method of transmission or storage is completely secure, and we cannot
              guarantee absolute security.
            </p>
          </PolicySection>

          <PolicySection title="6. Data Retention">
            <p>
              We retain personal information only for as long as necessary to fulfil the purposes
              described in this policy and to meet legal, accounting, and audit obligations. When data
              is no longer required, it is securely deleted or anonymized.
            </p>
          </PolicySection>

          <PolicySection title="7. Your Rights">
            <ul className="ml-5 list-disc space-y-2">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate or incomplete information.</li>
              <li>Request deletion of your information, subject to legal retention requirements.</li>
              <li>Withdraw consent to further processing where applicable.</li>
            </ul>
            <p>To exercise any of these rights, please contact us using the details below.</p>
          </PolicySection>

          <PolicySection title="8. Children's Privacy">
            <p>
              Some welfare schemes are intended to benefit children. Where we collect a child&rsquo;s
              information, it is provided and managed by a parent or legal guardian. We handle such
              information with additional care and only for the stated charitable purpose.
            </p>
          </PolicySection>

          <PolicySection title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this
              page with a revised &ldquo;Last updated&rdquo; date. We encourage you to review this page
              periodically.
            </p>
          </PolicySection>

          <PolicySection title="10. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy or your personal information,
              please reach out to us:
            </p>
            <ul className="ml-5 list-none space-y-1">
              <li>
                <strong>{orgName}</strong>
              </li>
              {address && <li>{address}</li>}
              {email && (
                <li>
                  Email:{" "}
                  <a href={`mailto:${email}`} className="text-primary hover:underline">
                    {email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  Phone:{" "}
                  <a href={`tel:${phone}`} className="text-primary hover:underline">
                    {phone}
                  </a>
                </li>
              )}
              {website && <li>Website: {website}</li>}
            </ul>
          </PolicySection>
        </div>
      </section>

      <SiteFooter settings={s} />
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {children}
    </div>
  );
}
