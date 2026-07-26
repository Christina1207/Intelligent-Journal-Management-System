import type { InfoSection } from "../types";

type InfoContentSectionProps = {
  sections: InfoSection[];
};

export function InfoContentSection({ sections }: InfoContentSectionProps) {
  return (
    <section className="py-12 sm:py-16" aria-labelledby="info-content-title">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 id="info-content-title" className="sr-only">
          Page information
        </h2>

        <div className="space-y-6">
          {sections.map((section) => (
            <article
              key={section.id}
              className="rounded-2xl border bg-white p-6 shadow-sm"
            >
              <h3 className="text-2xl font-bold text-slate-950">
                {section.title}
              </h3>

              <p className="mt-4 whitespace-pre-line leading-8 text-slate-700">
                {section.body}
              </p>

              {section.items && section.items.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3 text-slate-700">
                      <span
                        aria-hidden="true"
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-950"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
