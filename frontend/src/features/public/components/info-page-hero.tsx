import Link from "next/link";

type InfoPageHeroAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type InfoPageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: InfoPageHeroAction[];
};

export function InfoPageHero({
  eyebrow,
  title,
  description,
  actions = [],
}: InfoPageHeroProps) {
  return (
    <section className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {eyebrow}
        </p>

        <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
          {title}
        </h1>

        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          {description}
        </p>

        {actions.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={
                  action.variant === "secondary"
                    ? "rounded-md border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    : "rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
