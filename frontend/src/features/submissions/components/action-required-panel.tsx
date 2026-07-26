import Link from "next/link";
import { ArrowRight, CircleCheck, FilePenLine } from "lucide-react";

import { Notice } from "@/components/common/notice";
import { SectionHeader } from "@/components/common/section-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import type { AuthorDashboardActionItem } from "@/features/submissions/types";

type ActionRequiredPanelProps = {
  items: AuthorDashboardActionItem[];
};

export function ActionRequiredPanel({ items }: ActionRequiredPanelProps) {
  return (
    <section aria-labelledby="action-required-heading">
      <SectionHeader
        title="Action required"
        titleId="action-required-heading"
        description="Manuscripts waiting for a response from you."
      />

      {items.length === 0 ? (
        <Notice
          className="mt-4"
          tone="success"
          icon={CircleCheck}
          title="You are up to date"
          description="No submissions currently require action from you."
        />
      ) : (
        <div className="mt-4 grid gap-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="border-status-action-border bg-status-action-subtle"
            >
              <CardHeader className="flex-row items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-status-action-border bg-background/75 text-status-action-foreground">
                  <FilePenLine className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className="font-heading font-medium text-foreground"
                      dir="auto"
                    >
                      {item.title}
                    </h3>
                    <SubmissionStatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {item.section} · Revised files and a point-by-point response
                    are required.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex justify-end">
                <Link
                  href={`/author/submissions/${item.id}#revision-upload`}
                  className={buttonVariants({
                    variant: "default",
                    size: "touch",
                  })}
                >
                  Review request
                  <ArrowRight aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
