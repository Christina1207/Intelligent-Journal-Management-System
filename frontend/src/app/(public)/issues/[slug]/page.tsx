import { notFound } from "next/navigation";
import { PublicIssueDetailsPage } from "@/features/public/pages/public-issue-details-page";
import {
  PUBLIC_ARTICLE_PAGE_SIZE,
  getPublicIssue,
  getPublicIssueArticles,
  getPublicIssues,
} from "@/features/public/api/public-api";

type IssueDetailsRouteParams = {
  slug: string;
};

type IssueDetailsPageProps = {
  params: Promise<IssueDetailsRouteParams>;
  searchParams: Promise<{ page?: string | string[] }>;
};

function readPage(value?: string | string[]) {
  const page = Array.isArray(value) ? value[0] : value;
  const parsedPage = Number(page);

  return Number.isInteger(parsedPage) && parsedPage > 0
    ? String(parsedPage)
    : undefined;
}

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
  searchParams,
}: IssueDetailsPageProps) {
  const resolvedParams = await params;
  const page = readPage((await searchParams).page);

  const [issue, issues] = await Promise.all([
    getPublicIssue(resolvedParams.slug),
    getPublicIssues(),
  ]);

  if (!issue) {
    notFound();
  }

  const articleResponse = await getPublicIssueArticles(issue.slug, page);
  const previousIssues = issues
    .filter((candidate) => candidate.slug !== issue.slug)
    .slice(0, 3);

  return (
    <PublicIssueDetailsPage
      issue={issue}
      articles={articleResponse.results}
      articleCount={articleResponse.count}
      currentPage={Number(page ?? "1")}
      totalPages={Math.max(
        Math.ceil(articleResponse.count / PUBLIC_ARTICLE_PAGE_SIZE),
        1,
      )}
      previousIssues={previousIssues}
    />
  );
}
