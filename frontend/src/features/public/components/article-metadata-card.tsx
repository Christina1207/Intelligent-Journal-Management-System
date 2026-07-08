import type { PublicArticle } from "../types";
import { formatArticleDate } from "../utils/article-details";

type ArticleMetadataCardProps = {
  article: PublicArticle;
};

export function ArticleMetadataCard({ article }: ArticleMetadataCardProps) {
  return (
    <aside className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Article Metadata</h2>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="font-medium text-slate-500">Section</dt>
          <dd className="mt-1 text-slate-950">{article.section}</dd>
        </div>

        <div>
          <dt className="font-medium text-slate-500">Published</dt>
          <dd className="mt-1 text-slate-950">
            {formatArticleDate(article.publishedAt)}
          </dd>
        </div>

        {article.receivedAt ? (
          <div>
            <dt className="font-medium text-slate-500">Received</dt>
            <dd className="mt-1 text-slate-950">
              {formatArticleDate(article.receivedAt)}
            </dd>
          </div>
        ) : null}

        {article.acceptedAt ? (
          <div>
            <dt className="font-medium text-slate-500">Accepted</dt>
            <dd className="mt-1 text-slate-950">
              {formatArticleDate(article.acceptedAt)}
            </dd>
          </div>
        ) : null}

        {article.volume ? (
          <div>
            <dt className="font-medium text-slate-500">Volume</dt>
            <dd className="mt-1 text-slate-950">{article.volume}</dd>
          </div>
        ) : null}

        {article.issue ? (
          <div>
            <dt className="font-medium text-slate-500">Issue</dt>
            <dd className="mt-1 text-slate-950">{article.issue}</dd>
          </div>
        ) : null}

        {article.pages ? (
          <div>
            <dt className="font-medium text-slate-500">Pages</dt>
            <dd className="mt-1 text-slate-950">{article.pages}</dd>
          </div>
        ) : null}

        <div>
          <dt className="font-medium text-slate-500">Language</dt>
          <dd className="mt-1 text-slate-950">{article.language}</dd>
        </div>

        <div>
          <dt className="font-medium text-slate-500">License</dt>
          <dd className="mt-1 text-slate-950">{article.license}</dd>
        </div>

        <div>
          <dt className="font-medium text-slate-500">DOI</dt>
          <dd className="mt-1 break-words text-slate-950">
            {article.doi ? article.doi : "Not assigned"}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-slate-500">Usage</dt>
          <dd className="mt-1 text-slate-950">
            {article.views} views · {article.downloads} downloads
          </dd>
        </div>
      </dl>
    </aside>
  );
}
