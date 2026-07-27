import { cn } from "@/lib/utils";

type ManuscriptSummaryProps = {
  abstract?: string | null;
  className?: string;
  headingLevel?: 2 | 3 | 4;
  metadata?: React.ReactNode;
  title: string;
};

export function ManuscriptSummary({
  abstract,
  className,
  headingLevel = 3,
  metadata,
  title,
}: ManuscriptSummaryProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <div className={cn("min-w-0", className)}>
      <Heading className="line-clamp-2 font-medium leading-6" dir="auto">
        {title}
      </Heading>
      {metadata ? (
        <div className="mt-1 text-sm text-muted-foreground">{metadata}</div>
      ) : null}
      {abstract ? (
        <p
          className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground"
          dir="auto"
        >
          {abstract}
        </p>
      ) : null}
    </div>
  );
}
