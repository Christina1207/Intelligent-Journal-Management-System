import { allPublicArticles, publicIssues } from "../data/public-home.mock";
import type { PublicIssue } from "../types";

export function getCurrentIssue() {
  return publicIssues.find((issue) => issue.isCurrent) ?? publicIssues[0];
}

export function findPublicIssueBySlug(slug: string) {
  return publicIssues.find((issue) => issue.slug === slug);
}

export function getArticlesByIssueSlug(issueSlug: string) {
  return allPublicArticles
    .filter((article) => article.issueSlug === issueSlug)
    .sort(
      (first, second) =>
        new Date(second.publishedAt).getTime() -
        new Date(first.publishedAt).getTime(),
    );
}

export function getIssueArticleCount(issue: PublicIssue) {
  return getArticlesByIssueSlug(issue.slug).length;
}

export function getIssuesGroupedByYear() {
  const groupedIssues = new Map<string, PublicIssue[]>();

  publicIssues.forEach((issue) => {
    const existingIssues = groupedIssues.get(issue.year) ?? [];
    groupedIssues.set(issue.year, [...existingIssues, issue]);
  });

  return Array.from(groupedIssues.entries())
    .sort(([firstYear], [secondYear]) => Number(secondYear) - Number(firstYear))
    .map(([year, issues]) => ({
      year,
      issues: issues.sort(
        (first, second) =>
          new Date(second.publishedAt).getTime() -
          new Date(first.publishedAt).getTime(),
      ),
    }));
}

export function getPreviousIssues(currentIssue: PublicIssue, limit = 3) {
  return publicIssues
    .filter((issue) => issue.id !== currentIssue.id)
    .sort(
      (first, second) =>
        new Date(second.publishedAt).getTime() -
        new Date(first.publishedAt).getTime(),
    )
    .slice(0, limit);
}
