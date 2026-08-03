export type PlagiarismScreeningStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type PlagiarismRequester = {
  id: string;
  full_name: string;
};

export type PlagiarismReportSummary = {
  plagiarism_detected: boolean;
  flagged_segments_count: number;
  flagged_character_count: number;
  flagged_coverage_percent: number;
  accepted_evidence_count: number;
  matched_source_documents_count: number;
  highest_verifier_probability: number;
  plagiarism_types: string[];
};

export type PlagiarismScreeningSummary = {
  id: string;
  submission_id: string;
  submission_version_id: string;
  version_number: number;
  status: PlagiarismScreeningStatus;
  requested_by: PlagiarismRequester | null;
  source_type: string;
  pipeline_version: string;
  checkpoint_id: string;
  report_schema_version: string;
  summary: Partial<PlagiarismReportSummary>;
  error_code: string;
  error_message: string;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
};

export type PlagiarismOffsets = {
  start: number;
  end: number;
};

export type PlagiarismSourceSummary = {
  source_document_id: string;
  title: string;
  language: string | null;
  evidence_count: number;
  flagged_segments_supported: number;
  flagged_character_count: number;
  highest_verifier_probability: number;
};

export type PlagiarismEvidence = {
  evidence_id: string;
  source_document: {
    document_id: string;
    title: string;
    language: string | null;
  };
  source_segment: {
    segment_id: number | null;
    segment_index: number;
    offsets: PlagiarismOffsets;
    text: string;
  };
  scores: {
    verifier_probability: number;
    combined_retrieval_score: number | null;
    lexical_score: number | null;
    semantic_score: number | null;
  };
  plagiarism_type: string;
  requires_human_review: boolean;
};

export type PlagiarismFinding = {
  finding_id: string;
  status: "potential_plagiarism";
  finding_probability: number;
  suspicious_segment: {
    segment_index: number;
    offsets: PlagiarismOffsets;
    language: string | null;
    text: string;
  };
  evidence: PlagiarismEvidence[];
  requires_human_review: boolean;
};

export type PlagiarismReport = {
  schema_version: "plagiarism_report_v1";
  report_metadata: {
    report_id: string;
    generated_at: string;
    status: string;
    requires_human_review: boolean;
    review_message: string | null;
  };
  submitted_document: {
    document_id: string;
    title: string;
    language: string;
    character_count: number;
    character_count_source: string;
    segment_count: number;
    text: string | null;
    metadata: Record<string, unknown>;
  };
  pipeline: Record<string, unknown>;
  summary: PlagiarismReportSummary;
  source_summaries: PlagiarismSourceSummary[];
  findings: PlagiarismFinding[];
};

export type PlagiarismScreeningDetail = PlagiarismScreeningSummary & {
  report: PlagiarismReport | null;
};
