"use client";

import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

import { Notice } from "@/components/common/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PlagiarismEvidence,
  PlagiarismReport,
  PlagiarismScreeningDetail,
  PlagiarismScreeningSummary,
} from "@/features/integrity/types";

function formatProbability(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PlagiarismReportDialog({
  open,
  screening,
  detail,
  isLoading,
  isError,
  onOpenChange,
  onRetry,
}: {
  open: boolean;
  screening: PlagiarismScreeningSummary;
  detail: PlagiarismScreeningDetail | null;
  isLoading: boolean;
  isError: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}) {
  const report = detail?.report ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Plagiarism screening report</DialogTitle>
          <DialogDescription>
            Evidence generated for manuscript version {screening.version_number}
            . All matches require editorial verification.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div
            className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"
            role="status"
          >
            Loading the complete evidence report…
          </div>
        ) : null}

        {isError ? (
          <Notice
            tone="destructive"
            title="Could not load the report"
            description="The complete evidence report could not be retrieved."
            action={
              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={onRetry}
              >
                <RotateCcw aria-hidden="true" />
                Try again
              </Button>
            }
          />
        ) : null}

        {!isLoading && !isError && !report ? (
          <Notice
            tone="warning"
            title="Report evidence is unavailable"
            description="The screening completed, but no complete report was returned. Do not interpret this as a clean result."
          />
        ) : null}

        {report ? (
          <ReportContent report={report} screening={screening} />
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={() => onOpenChange(false)}
          >
            Close report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportContent({
  report,
  screening,
}: {
  report: PlagiarismReport;
  screening: PlagiarismScreeningSummary;
}) {
  const detected = report.summary.plagiarism_detected;

  return (
    <div className="space-y-6">
      <Notice
        tone={detected ? "warning" : "success"}
        icon={detected ? AlertTriangle : CheckCircle2}
        title={
          detected
            ? "Potential textual overlap requires review"
            : "No potential matches were flagged"
        }
        description={
          detected
            ? (report.report_metadata.review_message ??
              "Review the submitted and source passages before making an editorial decision.")
            : "This result is decision support only and does not prove that the manuscript is original."
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetric
          label="Flagged coverage"
          value={formatPercent(report.summary.flagged_coverage_percent)}
        />
        <ReportMetric
          label="Flagged segments"
          value={String(report.summary.flagged_segments_count)}
        />
        <ReportMetric
          label="Matched sources"
          value={String(report.summary.matched_source_documents_count)}
        />
        <ReportMetric
          label="Highest model score"
          value={formatProbability(report.summary.highest_verifier_probability)}
        />
      </dl>

      {report.source_summaries.length > 0 ? (
        <section>
          <h3 className="font-heading font-semibold text-foreground">
            Matched source documents
          </h3>
          <div className="mt-3 space-y-3">
            {report.source_summaries.map((source) => (
              <article
                key={source.source_document_id}
                className="rounded-lg border border-border/80 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground" dir="auto">
                      {source.title}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {source.source_document_id}
                    </p>
                  </div>
                  <Badge variant="warning">
                    {formatProbability(source.highest_verifier_probability)}
                  </Badge>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <ReportMetric
                    label="Evidence passages"
                    value={String(source.evidence_count)}
                    compact
                  />
                  <ReportMetric
                    label="Supported findings"
                    value={String(source.flagged_segments_supported)}
                    compact
                  />
                  <ReportMetric
                    label="Flagged characters"
                    value={String(source.flagged_character_count)}
                    compact
                  />
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="font-heading font-semibold text-foreground">
          Passage-level findings
        </h3>

        {report.findings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No passage-level findings were produced.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {report.findings.map((finding, index) => (
              <details
                key={finding.finding_id}
                open={index === 0}
                className="rounded-lg border border-border/80 bg-card"
              >
                <summary className="cursor-pointer p-4 font-medium text-foreground">
                  Finding {index + 1}
                  <Badge variant="warning" className="ml-2">
                    {formatProbability(finding.finding_probability)}
                  </Badge>
                </summary>

                <div className="space-y-4 border-t border-border/80 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Submitted passage
                    </p>
                    <blockquote
                      className="mt-2 whitespace-pre-wrap rounded-lg bg-status-action-subtle p-4 text-sm leading-7 text-foreground"
                      dir="auto"
                    >
                      {finding.suspicious_segment.text ||
                        "Submitted passage text is unavailable."}
                    </blockquote>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Character range {finding.suspicious_segment.offsets.start}
                      –{finding.suspicious_segment.offsets.end}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Source evidence
                    </p>
                    <div className="mt-2 space-y-3">
                      {finding.evidence.map((evidence) => (
                        <EvidenceCard
                          key={evidence.evidence_id}
                          evidence={evidence}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <details className="rounded-lg border border-border/80 bg-muted/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Technical audit details
        </summary>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <AuditItem
            label="Report ID"
            value={report.report_metadata.report_id}
          />
          <AuditItem
            label="Generated"
            value={formatDateTime(report.report_metadata.generated_at)}
          />
          <AuditItem label="Schema" value={report.schema_version} />
          <AuditItem
            label="Pipeline version"
            value={screening.pipeline_version}
          />
          <AuditItem
            label="Verifier checkpoint"
            value={screening.checkpoint_id}
          />
          <AuditItem label="Source type" value={screening.source_type} />
        </dl>
      </details>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: PlagiarismEvidence }) {
  return (
    <article className="rounded-lg border border-border/80 p-4">
      <p className="font-medium text-foreground" dir="auto">
        {evidence.source_document.title}
      </p>
      <p className="mt-1 break-all text-xs text-muted-foreground">
        {evidence.source_document.document_id}
      </p>

      <blockquote
        className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/45 p-4 text-sm leading-7 text-text-secondary"
        dir="auto"
      >
        {evidence.source_segment.text || "Source passage text is unavailable."}
      </blockquote>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportMetric
          label="Verifier"
          value={formatProbability(evidence.scores.verifier_probability)}
          compact
        />
        <ReportMetric
          label="Combined retrieval"
          value={formatOptionalScore(evidence.scores.combined_retrieval_score)}
          compact
        />
        <ReportMetric
          label="Lexical"
          value={formatOptionalScore(evidence.scores.lexical_score)}
          compact
        />
        <ReportMetric
          label="Semantic"
          value={formatOptionalScore(evidence.scores.semantic_score)}
          compact
        />
      </dl>
    </article>
  );
}

function formatOptionalScore(value: number | null) {
  return value === null ? "Not used" : value.toFixed(3);
}

function ReportMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-lg bg-muted/45 p-3"
          : "rounded-lg border border-border/80 bg-card p-4"
      }
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function AuditItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-medium text-foreground">{value}</dd>
    </div>
  );
}
