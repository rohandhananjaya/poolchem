import Link from "next/link";
import { Waves } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      'By accessing or using PoolChem ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms apply to all users, including company owners, technicians, and anyone accessing the Service through a homeowner dashboard link.',
  },
  {
    title: "2. Description of Service",
    content:
      "PoolChem provides a software platform for pool-service companies to record water test readings, calculate water health scores, recommend chemical doses, generate service reports, and manage scheduling. The Service is accessed via a web application and is provided on a software-as-a-service (SaaS) basis.",
  },
  {
    title: "3. Accounts",
    content:
      "3.1 Account Creation. Accounts are created by authorized administrators (company owners or platform admins). You must provide accurate and complete information and keep it updated.",
    items: [
      "3.2 Account Responsibility. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.",
      "3.3 Account Termination. You may request deletion of your account at any time via the profile settings or by contacting us. We may suspend or terminate accounts that violate these Terms.",
    ],
  },
  {
    title: "4. User Obligations",
    content: "You agree not to:",
    items: [
      "Use the Service for any unlawful purpose or in violation of any applicable laws.",
      "Attempt to access data belonging to another company or user.",
      "Share your account credentials with unauthorized individuals.",
      "Use the Service to store sensitive personal data beyond what is necessary for pool-service operations (e.g., avoid storing social security numbers, health records, or payment card numbers in free-text notes).",
      "Interfere with the proper functioning of the Service, including introducing malware or excessive request volume.",
    ],
  },
  {
    title: "5. Data Ownership & Privacy",
    content:
      "5.1 Your Data. You retain ownership of all data you enter into the Service. We process your data only as necessary to provide the Service, as described in our Privacy Policy.",
    items: [
      "5.2 Homeowner Data. If you store homeowner personal data (email, phone, address) in the Service, you represent that you have obtained any required consents or have a lawful basis to do so under applicable data protection laws.",
      "5.3 Data Deletion. Upon account termination, we will delete your personal data within a reasonable period, subject to our data retention policy and legal obligations.",
    ],
  },
  {
    title: "6. Fees & Payments",
    content:
      "6.1 Subscription Fees. Access to the Service may require payment of subscription fees. Fee details are provided at the time of purchase and may change with notice.",
    items: [
      "6.2 Payment Processor. Payments are processed securely by Stripe. We do not store full payment card details.",
      "6.3 Non-Payment. Failure to pay fees may result in suspension or termination of access to the Service.",
    ],
  },
  {
    title: "7. Intellectual Property",
    content:
      "The Service, including its code, design, branding, and underlying technology, is owned by PoolChem and is protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Service during your subscription period.",
  },
  {
    title: "8. Limitation of Liability",
    content:
      "The Service is provided \"as is\" without warranties of any kind, either express or implied. PoolChem is not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Water chemistry recommendations are informational and should be verified by qualified professionals. PoolChem does not guarantee specific water quality outcomes.",
  },
  {
    title: "9. Termination",
    content:
      "Either party may terminate these Terms at any time. Upon termination: (a) your access to the Service will be revoked; (b) we will delete your personal data in accordance with our Privacy Policy; (c) sections 7 (Intellectual Property), 8 (Limitation of Liability), and 10 (Governing Law) survive termination.",
  },
  {
    title: "10. Governing Law",
    content:
      "These Terms are governed by the laws of the State of Delaware, United States, without regard to its conflict of laws principles. For users in the European Economic Area, this does not affect your mandatory rights under local law.",
  },
  {
    title: "11. Changes to Terms",
    content:
      "We may update these Terms from time to time. Material changes will be notified via email or through the Service. Continued use after changes constitutes acceptance of the updated Terms.",
  },
  {
    title: "12. Contact",
    content:
      "For questions about these Terms, contact us at legal@poolchem.app.",
  },
];

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: July 12, 2026
          </p>
          <p className="mt-6 text-base leading-7 text-muted-foreground">
            These Terms of Service govern your use of the PoolChem platform.
            By using the Service, you agree to these Terms. If you are using
            the Service on behalf of a company, you represent that you have
            authority to bind that company to these Terms.
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
