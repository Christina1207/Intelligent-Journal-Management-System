import type { ContactMethod } from "../types";

type ContactCardProps = {
  contact: ContactMethod;
};

export function ContactCard({ contact }: ContactCardProps) {
  const content = (
    <>
      <h2 className="text-xl font-bold text-slate-950">{contact.title}</h2>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        {contact.value}
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {contact.description}
      </p>
    </>
  );

  if (contact.href) {
    return (
      <a
        href={contact.href}
        className="block rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        {content}
      </a>
    );
  }

  return (
    <article className="rounded-2xl border bg-white p-6 shadow-sm">
      {content}
    </article>
  );
}
