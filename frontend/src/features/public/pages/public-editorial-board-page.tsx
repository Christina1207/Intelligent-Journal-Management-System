import { EditorialMemberCard } from "../components/editorial-member-card";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { journalInfo } from "../data/public-home.mock";
import { editorialBoardMembers } from "../data/public-info.mock";

export function PublicEditorialBoardPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Editorial Board"
          title="Editorial leadership and scientific section management."
          description="The editorial board is responsible for journal quality, editorial policies, section supervision, peer-review coordination, and final publication decisions."
          actions={[
            { label: "Publication Ethics", href: "/publication-ethics" },
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

            <div className="grid gap-6 md:grid-cols-2">
              {editorialBoardMembers.map((member) => (
                <EditorialMemberCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
