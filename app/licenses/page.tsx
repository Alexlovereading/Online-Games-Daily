import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";

export const metadata: Metadata = {
  title: "Licenses & Credits",
  description:
    "Third-party attribution for the open-source projects several Online Games Daily game engines are adapted from, including upstream repositories, pinned commit SHAs, and full MIT license text.",
  alternates: { canonical: "/licenses" },
};

type NoticeSection = {
  heading: string;
  project?: string;
  repository?: string;
  body: string;
};

function parseNotice(): NoticeSection[] {
  const raw = readFileSync(join(process.cwd(), "NOTICE"), "utf-8")
    // Strip the file's own title header — the first project block follows it
    // directly with no "----" divider, unlike every later project.
    .replace(/^Online Games Daily third-party notices\n=+\n/, "");
  const blocks = raw.split(/\n-{10,}\n/g);

  return blocks
    .map((block, i) => {
      const trimmed = block.trim();
      const headingMatch = trimmed.match(/^(.+?)(?:\s+are adapted from:|\s+is adapted from:)/);
      const projectMatch = trimmed.match(/^Project:\s*(.+)$/m);
      const repoMatch = trimmed.match(/^Repository:\s*(.+)$/m);

      return {
        heading: headingMatch?.[1].trim() ?? `Attribution ${i + 1}`,
        project: projectMatch?.[1],
        repository: repoMatch?.[1],
        body: trimmed,
      };
    })
    .filter((section) => section.body.length > 0);
}

export default function LicensesPage() {
  const sections = parseNotice();

  return (
    <main className="prose-page site-shell [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-border [&_a]:transition-colors [&_a:hover]:text-primary [&_a:hover]:decoration-primary">
      <p className="eyebrow">Open source</p>
      <h1>Licenses &amp; Credits</h1>
      <p className="prose-lede">
        Several game engines on this site started life as MIT-licensed open-source projects. We
        pin each adaptation to a fixed upstream commit and keep the full license text and a record
        of what changed alongside the source. This page publishes that record.
      </p>

      <div className="prose-grid single-column">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.project ?? section.heading}</h2>
            {section.repository && (
              <p className="text-[color:var(--muted)]">
                Source: <a href={section.repository}>{section.repository}</a>
              </p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-bold text-foreground">
                Full attribution &amp; MIT license text
              </summary>
              <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-xs text-[color:var(--muted)]">
                {section.body}
              </pre>
            </details>
          </section>
        ))}
      </div>
    </main>
  );
}
