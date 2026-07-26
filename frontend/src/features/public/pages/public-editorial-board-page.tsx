import { Users } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"

import { EditorialMemberCard } from "../components/editorial-member-card"
import { InfoPageHero } from "../components/info-page-hero"
import type { EditorialBoardMember } from "../types"

type PublicEditorialBoardPageProps = {
  members: EditorialBoardMember[]
}

export function PublicEditorialBoardPage({
  members,
}: PublicEditorialBoardPageProps) {
  return (
    <>
      <InfoPageHero
        eyebrow="Editorial Board"
        title="Editorial Board"
        description={
          members.length > 0
            ? `${members.length} published editorial board member${
                members.length === 1 ? "" : "s"
              }.`
            : undefined
        }
        actions={[
          { label: "Publication Ethics", href: "/publication-ethics" },
          {
            label: "Contact the Journal",
            href: "/contact",
            variant: "secondary",
          },
        ]}
      />

      <section className="py-10 sm:py-12" aria-labelledby="board-title">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="board-title" className="sr-only">
            Editorial board members
          </h2>
          {members.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {members.map((member) => (
                <EditorialMemberCard key={member.id} member={member} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users aria-hidden="true" />}
              title="Editorial board information unavailable"
              description="Editorial board members have not been published through the journal API."
            />
          )}
        </div>
      </section>
    </>
  )
}
