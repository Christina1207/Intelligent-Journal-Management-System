import { notFound } from "next/navigation";
import { PublicIssueDetailsPage } from "@/features/public/pages/public-issue-details-page";
import {
  getPublicIssue,
  getPublicIssueArticles,
  getPublicIssues,
  getPublicJournal,
} from "@/features/public/api/public-api";

type IssueDetailsRouteParams = {
  slug: string;
};

type IssueDetailsPageProps = {
  params: Promise<IssueDetailsRouteParams>;
};

export async function generateMetadata({ params }: IssueDetailsPageProps) {
  const resolvedParams = await params;
  const issue = await getPublicIssue(resolvedParams.slug);

  if (!issue) {
    return {
      title: "Issue Not Found",
    };
  }

  return {
    title: `${issue.title} | Journal Archives`,
    description: issue.description,
  };
}

export default async function IssueDetailsPage({
  params,
}: IssueDetailsPageProps) {
  const resolvedParams = await params;

  const [journal, issue, issues] = await Promise.all([
    getPublicJournal(),
    getPublicIssue(resolvedParams.slug),
    getPublicIssues(),
  ]);

  if (!issue) {
    notFound();
  }

  const articles = await getPublicIssueArticles(issue.slug);
  const previousIssues = issues
    .filter((candidate) => candidate.slug !== issue.slug)
    .slice(0, 3);

  return (
    <PublicIssueDetailsPage
      journal={journal}
      issue={issue}
      articles={articles}
      previousIssues={previousIssues}
    />
  );
}
