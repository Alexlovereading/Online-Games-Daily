import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Online Games Daily — how we handle data, cookies, and Google AdSense advertising.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="prose-page site-shell [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-border [&_a]:transition-colors [&_a:hover]:text-primary [&_a:hover]:decoration-primary">
      <p className="eyebrow">Plain-language policy</p>
      <h1>Privacy Policy</h1>
      <p className="prose-lede">
        This Privacy Policy explains how Online Games Daily (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) handles information when you visit our website. Effective date:{" "}
        <strong>August 6, 2026</strong>.
      </p>

      <div className="prose-grid single-column">

        <section>
          <h2>1. Introduction</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            Online Games Daily is a collection of free daily puzzle games. We are committed to being
            transparent about how information is collected and used on this site. This policy covers
            data stored in your browser, third-party advertising through Google AdSense, and any
            analytics we may enable. By using our site you agree to the practices described here.
          </p>
          </div>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            We do not collect personal information directly. We do not require you to create an
            account, provide your name, or submit an email address to use any game on this site.
          </p>
          <p>
            When you play our games, your progress and statistics (such as puzzle completion status
            and win streaks) are saved in your browser&rsquo;s <strong>localStorage</strong>. This
            data stays on your device. It is never transmitted to our servers, and we have no access
            to it.
          </p>
          </div>
        </section>

        <section>
          <h2>3. Advertising — Google AdSense</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            We use <strong>Google AdSense</strong> to display advertisements on this site. Google
            AdSense is an advertising service operated by Google LLC. Google may use cookies,
            device identifiers, and similar technologies to serve ads that are personalised to your
            interests based on your browsing history across sites.
          </p>
          <p>
            Google&rsquo;s use of advertising cookies enables it and its partners to serve ads
            based on your visit to our site and other sites on the internet. For more information
            about how Google uses data when you use our site, please visit{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google&rsquo;s Privacy Policy
            </a>
            . You can manage or opt out of personalised ads at{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
              Google&rsquo;s Ad Settings
            </a>
            .
          </p>
          </div>
        </section>

        <section>
          <h2>4. Analytics</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            We may use Google Analytics or a similar analytics service to understand aggregate
            traffic patterns (e.g., which games are most popular, general geographic distribution).
            If analytics are active, they do not receive personal data such as your name or email.
            Any analytics provider we use will be named in an update to this policy before being
            enabled.
          </p>
          </div>
        </section>

        <section>
          <h2>5. Cookies</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            A cookie is a small text file placed on your device by a website to remember
            preferences or enable certain features. Online Games Daily itself does not set cookies for
            its own purposes. However, Google AdSense and analytics services may set their own
            cookies when you visit our pages. You can control cookie settings through your browser
            preferences; disabling cookies may affect ad personalisation but will not prevent the
            games from working.
          </p>
          </div>
        </section>

        <section>
          <h2>6. Third-Party Services</h2>
          <div className="text-[color:var(--muted)]">
          <p>We use the following third-party services:</p>
          <ul>
            <li>
              <strong>Google AdSense</strong> — advertising. Subject to{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                Google&rsquo;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Cloudflare</strong> — CDN and hosting. Cloudflare may collect anonymised
              network-level data such as IP addresses for security and performance purposes. See{" "}
              <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
                Cloudflare&rsquo;s Privacy Policy
              </a>
              .
            </li>
          </ul>
          <p>
            We do not control the data practices of these third parties and encourage you to review
            their policies.
          </p>
          </div>
        </section>

        <section>
          <h2>7. Your Choices</h2>
          <div className="text-[color:var(--muted)]">
          <p>You have several options for managing how advertising data is used:</p>
          <ul>
            <li>
              <strong>Google Ad Settings:</strong>{" "}
              <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
                adssettings.google.com
              </a>{" "}
              — opt out of personalised ads from Google.
            </li>
            <li>
              <strong>NAI Opt-Out:</strong>{" "}
              <a href="http://optout.networkadvertising.org" target="_blank" rel="noopener noreferrer">
                optout.networkadvertising.org
              </a>{" "}
              — opt out of interest-based advertising from NAI member companies.
            </li>
            <li>
              <strong>Browser settings:</strong> You can clear or block cookies at any time through
              your browser&rsquo;s privacy or settings menu.
            </li>
            <li>
              <strong>Local game data:</strong> You can delete your locally stored game progress
              and statistics by clearing your browser&rsquo;s localStorage (Settings → Privacy →
              Clear browsing data → Cached data and cookies, or equivalent in your browser).
            </li>
          </ul>
          </div>
        </section>

        <section>
          <h2>8. GDPR — EU and EEA Users</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            If you are located in the European Union or European Economic Area, the following
            applies under the General Data Protection Regulation (GDPR):
          </p>
          <ul>
            <li>
              <strong>Legal basis:</strong> We rely on legitimate interests for aggregate analytics.
              For personalised advertising through Google AdSense, Google obtains consent or
              relies on legitimate interests in accordance with its own legal bases. We display
              Google&rsquo;s consent banner where required.
            </li>
            <li>
              <strong>Your rights:</strong> You have the right to access, rectify, delete, and
              port any personal data we hold, and to object to or restrict processing. Because we
              do not collect personal data directly, these rights primarily apply to data held by
              our third-party partners (Google, Cloudflare).
            </li>
            <li>
              <strong>Exercising your rights:</strong> For requests related to our site, contact us
              at{" "}
              <a href="mailto:contact@onlinegamesdaily.com">contact@onlinegamesdaily.com</a>. For data
              held by Google, use the tools at{" "}
              <a href="https://myaccount.google.com/data-and-privacy" target="_blank" rel="noopener noreferrer">
                Google&rsquo;s Data &amp; Privacy
              </a>{" "}
              page.
            </li>
          </ul>
          </div>
        </section>

        <section>
          <h2>9. CCPA — California Users</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            If you are a California resident, the California Consumer Privacy Act (CCPA) gives you
            additional rights:
          </p>
          <ul>
            <li>
              <strong>We do not sell personal information.</strong> We do not sell your personal
              data to third parties for monetary or other valuable consideration.
            </li>
            <li>
              <strong>Right to know:</strong> You may request information about any personal data we
              collect. As noted above, we do not collect personal data directly, so there is
              nothing to disclose beyond this policy.
            </li>
            <li>
              <strong>Right to delete:</strong> You may request deletion of any personal data we
              hold. Since we hold none, the right is satisfied by the architecture of our site.
            </li>
          </ul>
          <p>
            To submit a CCPA request or for questions, contact us at{" "}
            <a href="mailto:contact@onlinegamesdaily.com">contact@onlinegamesdaily.com</a>.
          </p>
          </div>
        </section>

        <section>
          <h2>10. Children&rsquo;s Privacy</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            Online Games Daily is not directed at children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you believe a child under 13
            has provided personal information through our site, please contact us and we will take
            appropriate steps to remove that information.
          </p>
          </div>
        </section>

        <section>
          <h2>11. Updates to This Policy</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our
            practices or applicable law. When we make material changes, we will update the
            effective date at the top of this page. We encourage you to review this policy
            periodically. Your continued use of the site after any update constitutes your
            acceptance of the revised policy.
          </p>
          </div>
        </section>

        <section>
          <h2>12. Contact</h2>
          <div className="text-[color:var(--muted)]">
          <p>
            If you have questions, concerns, or requests related to this Privacy Policy, please
            contact us at:{" "}
            <a href="mailto:contact@onlinegamesdaily.com">contact@onlinegamesdaily.com</a>
          </p>
          <p>We aim to respond within 2 business days.</p>
          </div>
        </section>

        <p className="policy-date">Last updated: August 6, 2026</p>
      </div>
    </main>
  );
}
