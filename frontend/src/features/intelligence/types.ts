import type { SubmissionStatus } from "@/features/submissions/types";
export type TopicAnalysisStatus = "not_started" | "partial" | "complete";

export interface TopicAggregate {
  label: string;
  submission_count: number;
  percentage_of_clustered: number;
  keywords: string[];
}

export interface AuthorKeywordAggregate {
  keyword: string;
  submission_count: number;
}

export interface SectionTopicAggregate {
  section: {
    id: string;
    name: string;
    slug: string;
  };
  analysis_status: TopicAnalysisStatus;
  last_clustered_at: string | null;
  total_submissions: number;
  analyzed_submissions: number;
  clustered_submissions: number;
  outlier_submissions: number;
  pending_analysis: number;
  topics: TopicAggregate[];
  top_author_keywords: AuthorKeywordAggregate[];
}

export interface SectionTopicAnalyticsResponse {
  generated_at: string;
  sections: SectionTopicAggregate[];
}
export interface EditorialAnalyticsSummary {
  total_submissions: number;
  total_publications: number;
  accepted_count: number;
  rejected_count: number;
  acceptance_rate: number;
  rejection_rate: number;
  median_decision_duration_days: number | null;
  median_review_duration_days: number | null;
}

export interface AnalyticsStatusCount {
  code: SubmissionStatus;
  label: string;
  count: number;
}

export interface AnalyticsTimePoint {
  month: string;
  count: number;
}

export interface AnalyticsSectionCount {
  id: string;
  name: string;
  submission_count: number;
}

export interface AnalyticsTopicCount {
  label: string;
  submission_count: number;
}

export interface AnalyticsTopicDistribution {
  topics: AnalyticsTopicCount[];
  unclassified_count: number;
}

export interface AnalyticsOverdueWork {
  overdue_invitations: number;
  overdue_reviews: number;
  total: number;
}

export interface PrioritySection {
  id: string;
  name: string;
}

export interface PriorityEditor {
  id: string;
  full_name: string;
}

export interface PriorityFactor {
  key: string;
  label: string;
  score: number;
  weight: number;
  contribution: number;
  details: Record<string, string | number | boolean | null>;
  explanation: string;
}

export interface PriorityQueueItem {
  submission_id: string;
  title: string;
  status: SubmissionStatus;
  section: PrioritySection;
  assigned_editor: PriorityEditor | null;
  submitted_at: string;
  latest_version_number: number | null;
  method: string;
  score: number;
  factors: PriorityFactor[];
}

export interface DurationDefinitions {
  decision_duration: string;
  review_duration: string;
}

export interface EditorialAnalyticsDashboardResponse {
  generated_at: string;
  period_months: number;
  summary: EditorialAnalyticsSummary;
  status_distribution: AnalyticsStatusCount[];
  submissions_over_time: AnalyticsTimePoint[];
  publications_over_time: AnalyticsTimePoint[];
  section_distribution: AnalyticsSectionCount[];
  topic_distribution: AnalyticsTopicDistribution;
  overdue_work: AnalyticsOverdueWork;
  priority_queue: PriorityQueueItem[];
  duration_definitions: DurationDefinitions;
}
