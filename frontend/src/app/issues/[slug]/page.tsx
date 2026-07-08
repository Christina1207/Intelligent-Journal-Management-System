import { notFound } from "next/navigation";
import { PublicIssueDetailsPage } from "@/features/public/pages/public-issue-details-page";
import { publicIssues } from "@/features/public/data/public-home.mock";
import {
  findPublicIssueBySlug,
  getArticlesByIssueSlug,
} from "@/features/public/utils/public-issues";

type IssueDetailsRouteParams = {
  slug: string;
};

type IssueDetailsPageProps = {
  params: Promise<IssueDetailsRouteParams>;
};

export function generateStaticParams() {
  return publicIssues.map((issue) => ({
    slug: issue.slug,
  }));
}

export async function generateMetadata({ params }: IssueDetailsPageProps) {
  const resolvedParams = await params;
  const issue = findPublicIssueBySlug(resolvedParams.slug);

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
  const issue = findPublicIssueBySlug(resolvedParams.slug);

  if (!issue) {
    notFound();
  }

  const articles = getArticlesByIssueSlug(issue.slug);

  return <PublicIssueDetailsPage issue={issue} articles={articles} />;
}
