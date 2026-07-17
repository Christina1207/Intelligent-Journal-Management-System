import { EditorialMemberCard } from "../components/editorial-member-card";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import type { EditorialBoardMember, JournalInfo } from "../types";

type PublicEditorialBoardPageProps = {
  journal: JournalInfo;
  members: EditorialBoardMember[];
};

export function PublicEditorialBoardPage({
  journal,
  members,
}: PublicEditorialBoardPageProps) {
  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Editorial Board"
          title="Editorial leadership and scientific section management."
          description="The editorial board is responsible for journal quality, editorial policies, section supervision, peer-review coordination, and final publication decisions."
          actions={[
            {
              label: "Publication Ethics",
              href: "/publication-ethics",
            },
            {
              label: "Contact the Journal",
              href: "/contact",
              variant: "secondary",
            },
          ]}
        />

        <section className="py-12 sm:py-16" aria-labelledby="board-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="board-title" className="sr-only">
              Editorial board members
            </h2>

            {members.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {members.map((member) => (
                  <EditorialMemberCard key={member.id} member={member} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">
                  Editorial board information unavailable
                </h2>

                <p className="mt-3 text-slate-600">
                  Editorial board information has not been published yet.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
