from dataclasses import dataclass
from datetime import date
from typing import Optional
from urllib.parse import urljoin

from django.http import Http404
from django.urls import reverse

from apps.journals.models import JournalMetadataSettings

from .models import PublishedArticle


@dataclass(frozen=True)
class ArticleAuthorMetadata:
    full_name: str
    email: Optional[str]
    orcid: Optional[str]
    affiliation: Optional[str]
    country: Optional[str]
    order: int
    is_corresponding: bool


@dataclass(frozen=True)
class ArticleMetadata:
    title: Optional[str]
    abstract: Optional[str]
    authors: list[ArticleAuthorMetadata]
    journal_title: Optional[str]
    publisher_name: Optional[str]
    print_issn: Optional[str]
    online_issn: Optional[str]
    section_name: Optional[str]
    publication_date: Optional[date]
    year: Optional[str]
    doi: Optional[str]
    slug: Optional[str]
    article_url: Optional[str]
    pdf_url: Optional[str]
    language: Optional[str]
    keywords: list[str]
    license_name: Optional[str]
    license_url: Optional[str]
    volume: Optional[str]
    issue: Optional[str]
    first_page: Optional[str]
    last_page: Optional[str]


class ArticleMetadataBuilder:
    def __init__(self, *, request=None, base_url: Optional[str] = None):
        self.request = request
        self.base_url = _clean_text(base_url)

    def build(self, article: PublishedArticle) -> ArticleMetadata:
        if article.status != PublishedArticle.Status.PUBLISHED:
            raise Http404("Article not found.")

        journal_settings = self._get_journal_settings()
        publication_date = article.published_at.date() if article.published_at else None

        return ArticleMetadata(
            title=_clean_text(article.title),
            abstract=_clean_text(article.abstract),
            authors=self._build_authors(article),
            journal_title=_clean_text(journal_settings.journal_title),
            publisher_name=_clean_text(journal_settings.publisher_name),
            print_issn=_clean_text(journal_settings.print_issn),
            online_issn=_clean_text(journal_settings.online_issn),
            section_name=_clean_text(getattr(article.section, "name", None)),
            publication_date=publication_date,
            year=str(publication_date.year) if publication_date else None,
            doi=_clean_text(article.doi),
            slug=_clean_text(article.slug),
            article_url=self._build_url(
                "public-article-detail",
                {"slug": article.slug},
                journal_settings=journal_settings,
            ),
            pdf_url=self._build_pdf_url(article, journal_settings=journal_settings),
            language=_clean_text(article.language or journal_settings.default_language),
            keywords=_clean_keywords(article.keywords),
            license_name=_clean_text(article.license_name),
            license_url=_clean_text(article.license_url),
            volume=_clean_text(article.volume),
            issue=_clean_text(article.issue),
            first_page=_clean_text(article.first_page),
            last_page=_clean_text(article.last_page),
        )

    def _build_authors(self, article: PublishedArticle) -> list[ArticleAuthorMetadata]:
        return [
            ArticleAuthorMetadata(
                full_name=_clean_text(author.full_name) or "",
                email=_clean_text(author.email),
                orcid=_clean_text(author.orcid),
                affiliation=_clean_text(author.affiliation),
                country=_clean_text(author.country),
                order=author.order,
                is_corresponding=author.is_corresponding,
            )
            for author in article.authors.all().order_by("order")
        ]

    def _build_pdf_url(
        self,
        article: PublishedArticle,
        *,
        journal_settings: JournalMetadataSettings,
    ) -> Optional[str]:
        if not article.pdf_file:
            return None
        return self._build_url(
            "public-article-download",
            {"slug": article.slug},
            journal_settings=journal_settings,
        )

    def _build_url(
        self,
        route_name: str,
        kwargs: dict,
        *,
        journal_settings: JournalMetadataSettings,
    ) -> Optional[str]:
        path = reverse(route_name, kwargs=kwargs)
        base_url = self.base_url or _clean_text(journal_settings.base_url)

        if base_url:
            return urljoin(f"{base_url.rstrip('/')}/", path.lstrip("/"))

        if self.request is not None:
            return self.request.build_absolute_uri(path)

        return None

    def _get_journal_settings(self) -> JournalMetadataSettings:
        settings = JournalMetadataSettings.objects.filter(
            pk=JournalMetadataSettings.SINGLETON_PK
        ).first()
        if settings is not None:
            return settings
        return JournalMetadataSettings()


def _clean_text(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _clean_keywords(value) -> list[str]:
    if not isinstance(value, list):
        return []

    keywords = []
    for item in value:
        text = _clean_text(item)
        if text:
            keywords.append(text)
    return keywords
