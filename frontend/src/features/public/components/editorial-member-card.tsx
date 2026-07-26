import { Mail } from "lucide-react"

import { Badge } from "@/components/ui/badge"

import type { EditorialBoardMember } from "../types"

type EditorialMemberCardProps = {
  member: EditorialBoardMember
}

export function EditorialMemberCard({ member }: EditorialMemberCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
        {member.role}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-foreground" dir="auto">
        {member.name}
      </h2>
      {member.affiliation ? (
        <p className="mt-2 text-sm leading-6 text-text-secondary" dir="auto">
          {member.affiliation}
        </p>
      ) : null}

      {member.expertise.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Expertise">
          {member.expertise.map((item) => (
            <Badge key={item} variant="secondary" dir="auto">
              {item}
            </Badge>
          ))}
        </div>
      ) : null}

      {member.email ? (
        <a
          href={`mailto:${member.email}`}
          className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          <Mail className="size-4" aria-hidden="true" />
          Contact
        </a>
      ) : null}
    </article>
  )
}
