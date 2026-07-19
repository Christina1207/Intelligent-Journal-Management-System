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
