import type { EditorialBoardMember } from "../types";

type EditorialMemberCardProps = {
  member: EditorialBoardMember;
};

export function EditorialMemberCard({ member }: EditorialMemberCardProps) {
  return (
    <article className="rounded-2xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {member.role}
      </p>

      <h2 className="mt-3 text-xl font-bold text-slate-950">{member.name}</h2>

      <p className="mt-2 text-sm text-slate-600">{member.affiliation}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {member.expertise.map((item) => (
          <span
            key={item}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
          >
            {item}
          </span>
        ))}
      </div>

      {member.email ? (
        <a
          href={`mailto:${member.email}`}
          className="mt-5 inline-flex text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
        >
          Contact
        </a>
      ) : null}
    </article>
  );
}
