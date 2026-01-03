import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4 pb-8 max-w-2xl mx-auto">
          <div className="space-y-6 text-sm text-muted-foreground">
            <p className="text-xs text-muted-foreground/70">
              Last updated: January 2026
            </p>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Introduction</h2>
              <p>
                ToonReels ("we," "our," or "us") is committed to protecting the privacy of our users, 
                especially children. This Privacy Policy explains how we collect, use, disclose, and 
                safeguard your information when you use our mobile application.
              </p>
              <p>
                ToonReels is designed for children ages 4-15 and complies with the Children's Online 
                Privacy Protection Act (COPPA) and other applicable privacy laws.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Information We Collect</h2>
              
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Account Information</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Username (no real names required)</li>
                  <li>Email address (for account verification)</li>
                  <li>Age range selection</li>
                  <li>Profile avatar selection</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Usage Information</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Videos watched and watch duration</li>
                  <li>Likes and saved content</li>
                  <li>Comments (moderated for safety)</li>
                  <li>Device type for optimization</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Content Uploads (Creators Only)</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Video content uploaded to the platform</li>
                  <li>Thumbnails and descriptions</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>To provide and maintain our service</li>
                <li>To personalize content recommendations</li>
                <li>To enable social features (likes, comments, follows)</li>
                <li>To ensure platform safety and moderation</li>
                <li>To communicate important updates</li>
                <li>To improve our app and user experience</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Children's Privacy (COPPA Compliance)</h2>
              <p>
                We take children's privacy very seriously. For users under 13:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>We collect only minimal information necessary for the service</li>
                <li>We do not require real names or personal identifiers</li>
                <li>We provide parental controls and PIN protection</li>
                <li>Parents can review and delete their child's data</li>
                <li>We do not serve targeted advertising to children</li>
                <li>Comments are moderated and filtered for safety</li>
                <li>Messaging features have safety restrictions</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Parental Controls</h2>
              <p>
                ToonReels provides comprehensive parental controls including:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>PIN-protected settings access</li>
                <li>Screen time limits</li>
                <li>Bedtime and school hours restrictions</li>
                <li>Content category filtering</li>
                <li>Comment visibility controls</li>
                <li>Interaction limits</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Data Sharing and Disclosure</h2>
              <p>
                We do not sell, trade, or rent your personal information. We may share data only:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>With service providers who assist in operating our app</li>
                <li>To comply with legal obligations</li>
                <li>To protect the safety of our users</li>
                <li>With your consent</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Data Security</h2>
              <p>
                We implement appropriate security measures to protect your information, including:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure cloud storage with access controls</li>
                <li>Regular security audits and updates</li>
                <li>PIN-protected sensitive features</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Data Retention and Deletion</h2>
              <p>
                We retain your data only as long as necessary to provide our services. You can:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Delete your account at any time through Settings</li>
                <li>Request deletion of specific content</li>
                <li>Contact us to request complete data removal</li>
              </ul>
              <p>
                Upon account deletion, we remove all personal data within 30 days, except where 
                retention is required by law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Cookies and Local Storage</h2>
              <p>
                ToonReels uses local storage to:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Remember your login session</li>
                <li>Store app preferences and settings</li>
                <li>Track milestone achievements locally</li>
              </ul>
              <p>
                We do not use third-party tracking cookies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Your Rights</h2>
              <p>
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and data</li>
                <li>Opt-out of non-essential communications</li>
                <li>Request a copy of your data</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any 
                changes by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="font-medium text-foreground">ToonReels Support</p>
                <p>Email: privacy@toonreels.app</p>
                <p>For parental inquiries: parents@toonreels.app</p>
              </div>
            </section>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground/70">
                © 2026 ToonReels. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default PrivacyPolicy;
