import Link from "next/link";
import { Waves } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "1. Who we are",
    content:
      "PoolChem (\"we\", \"our\", \"us\") operates the PoolChem application and website. We are a pool-service software provider. If you have questions about this policy, contact us at privacy@poolchem.app.",
  },
  {
    title: "2. What personal data we collect",
    content:
      "We collect the following categories of personal data depending on how you interact with our service:",
    items: [
      "Account information: name, email address, phone number, and password (stored securely by Supabase Auth).",
      "Company information: company name, business email, business phone, and business address.",
      "Pool information: pool address, homeowner email, homeowner phone, and free-text notes (which may contain personal data).",
      "Service visit records: visit notes, test readings, chemical dosing records.",
      "Authentication data: Supabase session tokens stored as cookies.",
      "Payment data: Stripe customer and subscription identifiers (no full payment details are stored by us).",
    ],
  },
  {
    title: "3. How we collect your data",
    content:
      "We collect data when you: (a) sign in via email/password or Google OAuth; (b) create or update your account or company profile; (c) create or update pool records; (d) record service visits; (e) interact with our support team.",
  },
  {
    title: "4. Why we process your data (legal bases)",
    content: "We process your personal data under the following legal bases:",
    items: [
      "Contractual necessity (Art. 6(1)(b) GDPR): to deliver the PoolChem service, manage your account, and process transactions.",
      "Legitimate interest (Art. 6(1)(f) GDPR): to improve our service, ensure security, and communicate with you about your account.",
      "Consent (Art. 6(1)(a) GDPR): for non-essential cookies, marketing communications, and Google OAuth data sharing.",
    ],
  },
  {
    title: "5. Data retention",
    content:
      "We retain your personal data for as long as your account is active and for a reasonable period afterward to comply with legal obligations. Specifically:",
    items: [
      "Account data: retained until account deletion plus 30 days for recovery purposes, then permanently deleted.",
      "Service visit records: retained for the duration of your account plus 2 years.",
      "System logs: retained for 90 days.",
      "You may request earlier deletion of your data at any time (see Your Rights below).",
    ],
  },
  {
    title: "6. Third-party data processors",
    content:
      "We share your personal data with the following service providers who process data on our behalf. Each is contractually obliged to protect your data:",
    items: [
      "Supabase Inc. — authentication, database hosting, session management (privacy policy: supabase.com/privacy).",
      "Google LLC — OAuth sign-in (only if you choose Google login). Google receives your email, name, and avatar URL (privacy policy: policies.google.com/privacy).",
      "Stripe Inc. — payment processing (only when billing is active). We store only Stripe customer/subscription IDs, no full payment details (privacy policy: stripe.com/privacy).",
    ],
  },
  {
    title: "7. Cookies",
    content:
      "We use essential cookies to operate our service:",
    items: [
      "Supabase session cookies (sb-*-auth-token): required for authentication. These are set when you sign in and are necessary for the service to function.",
      "No tracking, analytics, or advertising cookies are currently used. If we add analytics in the future, we will update this policy and seek your consent where required.",
    ],
  },
  {
    title: "8. Your GDPR rights",
    content:
      "If you are located in the European Economic Area (EEA), you have the following rights regarding your personal data:",
    items: [
      "Right of access (Art. 15): request a copy of the personal data we hold about you.",
      "Right to rectification (Art. 16): correct inaccurate or incomplete data.",
      "Right to erasure (Art. 17): request deletion of your data (the \"right to be forgotten\").",
      "Right to restrict processing (Art. 18): limit how we use your data.",
      "Right to data portability (Art. 20): receive your data in a structured, machine-readable format.",
      "Right to object (Art. 21): object to processing based on legitimate interest.",
      "To exercise any of these rights, contact us at privacy@poolchem.app or use the self-service tools in your account settings.",
    ],
  },
  {
    title: "9. Security",
    content:
      "We implement appropriate technical and organizational measures to protect your personal data, including encryption in transit (TLS), server-side session management, role-based access control, and tenant-scoped data isolation.",
  },
  {
    title: "10. International transfers",
    content:
      "Your data is processed in the United States. If you are in the EEA, we rely on Standard Contractual Clauses (SCCs) as the transfer mechanism for data processed by our sub-processors (Supabase, Google, Stripe).",
  },
  {
    title: "11. Changes to this policy",
    content:
      "We may update this privacy policy from time to time. Material changes will be notified via email or through the application. Continued use of the service after changes constitutes acceptance of the updated policy.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
              <Waves className="size-5" />
            </span>
            <span className="text-lg">PoolChem</span>
          </Link>
          <Button asChild variant="ghost" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: July 12, 2026
          </p>
          <p className="mt-6 text-base leading-7 text-muted-foreground">
            This Privacy Policy explains how PoolChem collects, uses, processes,
            and shares your personal data when you use our application and website.
            It applies to all users of the platform, including company owners,
            technicians, and homeowners whose data is stored in the system.
          </p>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                <p className="mt-3 text-base leading-7 text-muted-foreground">
                  {section.content}
                </p>
                {section.items ? (
                  <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-7 text-muted-foreground">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold tracking-tight">
              Contact
            </h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground">
              For any questions about this policy or to exercise your GDPR rights,
              contact our data protection team:
            </p>
            <p className="mt-2 text-base">
              Email:{" "}
              <a
                href="mailto:privacy@poolchem.app"
                className="text-sky-600 underline hover:text-sky-500 dark:text-sky-400"
              >
                privacy@poolchem.app
              </a>
            </p>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:px-6">
          <Link href="/" className="flex items-center gap-2 font-medium text-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-sky-500 text-white">
              <Waves className="size-4" />
            </span>
            PoolChem
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
          <p>© 2026 PoolChem. Water chemistry, handled.</p>
        </div>
      </footer>
    </div>
  );
}
