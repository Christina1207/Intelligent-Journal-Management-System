from dataclasses import dataclass, field
from datetime import date, datetime, timezone as datetime_timezone
import re
from typing import Optional
from urllib.parse import urljoin, urlparse

from django.http import QueryDict
from django.utils import timezone
from django.utils.text import slugify

from apps.journals.models import JournalMetadataSettings, Section
from apps.publishing.metadata import ArticleMetadata, ArticleMetadataBuilder
from apps.publishing.models import PublishedArticle


OAI_METADATA_PREFIX = "oai_dc"
OAI_DELETED_RECORD_POLICY = "no"
OAI_GRANULARITY = "YYYY-MM-DD"


@dataclass(frozen=True)
class OAIError:
    code: str
    message: str


@dataclass(frozen=True)
class OAIRequestError(Exception):
    error: OAIError


@dataclass(frozen=True)
class MetadataFormat:
    metadata_prefix: str
    schema: str
    metadata_namespace: str


@dataclass(frozen=True)
class SectionSet:
    spec: str
    name: str


@dataclass(frozen=True)
class IdentifyInfo:
    repository_name: str
    base_url: str
    protocol_version: str
    admin_email: str
    earliest_datestamp: str
    deleted_record: str
    granularity: str


@dataclass(frozen=True)
class OAIRecord:
    identifier: str
    datestamp: str
    set_spec: Optional[str]
    metadata: Optional[ArticleMetadata] = None


@dataclass(frozen=True)
class OAIResponse:
    verb: Optional[str]
    request_attributes: dict[str, str]
    payload: object = None
    errors: list[OAIError] = field(default_factory=list)


class OAIProviderService:
    supported_verbs = {
        "Identify",
        "ListMetadataFormats",
        "ListSets",
        "ListIdentifiers",
        "ListRecords",
        "GetRecord",
    }

    metadata_format = MetadataFormat(
        metadata_prefix=OAI_METADATA_PREFIX,
        schema="http://www.openarchives.org/OAI/2.0/oai_dc.xsd",
        metadata_namespace="http://www.openarchives.org/OAI/2.0/oai_dc/",
    )

    def __init__(self, *, request):
        self.request = request
        self.params: QueryDict = request.GET
        self.journal_settings = JournalMetadataSettings.get_current()
        self.repository_identifier = self._build_repository_identifier()
        self.oai_base_url = self._build_oai_base_url()

    def handle(self) -> OAIResponse:
        verb = None
        try:
            self._validate_unique_arguments()
            verb = self._get_argument("verb")
            if not verb or verb not in self.supported_verbs:
                return OAIResponse(
                    verb=verb,
                    request_attributes=self._request_attributes(verb=verb),
                    errors=[self._error("badVerb", "The requested OAI verb is not supported.")],
                )

            handlers = {
                "Identify": self._handle_identify,
                "ListMetadataFormats": self._handle_list_metadata_formats,
                "ListSets": self._handle_list_sets,
                "ListIdentifiers": self._handle_list_identifiers,
                "ListRecords": self._handle_list_records,
                "GetRecord": self._handle_get_record,
            }
            return handlers[verb]()
        except OAIRequestError as exc:
            return OAIResponse(
                verb=verb,
                request_attributes=self._request_attributes(verb=verb),
                errors=[exc.error],
            )

    def _handle_identify(self) -> OAIResponse:
        self._validate_allowed_arguments({"verb"})
        repository_name = (
            self._clean_text(self.journal_settings.oai_repository_name)
            or self._clean_text(self.journal_settings.journal_title)
            or "Untitled Journal"
        )
        admin_email = (
            self._clean_text(self.journal_settings.oai_admin_email)
            or "webmaster@localhost"
        )

        return OAIResponse(
            verb="Identify",
            request_attributes=self._request_attributes(verb="Identify"),
            payload=IdentifyInfo(
                repository_name=repository_name,
                base_url=self.oai_base_url,
                protocol_version="2.0",
                admin_email=admin_email,
                earliest_datestamp=self._earliest_datestamp(),
                deleted_record=OAI_DELETED_RECORD_POLICY,
                granularity=OAI_GRANULARITY,
            ),
        )

    def _handle_list_metadata_formats(self) -> OAIResponse:
        self._validate_allowed_arguments({"verb", "identifier"})
        identifier = self._get_argument("identifier")
        if identifier:
            self._get_article_for_identifier(identifier)

        return OAIResponse(
            verb="ListMetadataFormats",
            request_attributes=self._request_attributes(
                verb="ListMetadataFormats",
                optional_arguments=("identifier",),
            ),
            payload=[self.metadata_format],
        )

    def _handle_list_sets(self) -> OAIResponse:
        self._validate_allowed_arguments({"verb"})
        sets = [
            SectionSet(spec=self.section_set_spec(section), name=section.name)
            for section in Section.objects.filter(is_active=True).order_by("name")
        ]
        if not sets:
            return OAIResponse(
                verb="ListSets",
                request_attributes=self._request_attributes(verb="ListSets"),
                errors=[
                    self._error(
                        "noSetHierarchy",
                        "This repository has no active OAI sets.",
                    )
                ],
            )
        return OAIResponse(
            verb="ListSets",
            request_attributes=self._request_attributes(verb="ListSets"),
            payload=sets,
        )

    def _handle_list_identifiers(self) -> OAIResponse:
        self._validate_allowed_arguments({"verb", "metadataPrefix", "from", "until", "set"})
        self._validate_metadata_prefix()
        records = self._list_records(include_metadata=False)
        if not records:
            raise self._request_error("noRecordsMatch", "No matching records were found.")

        return OAIResponse(
            verb="ListIdentifiers",
            request_attributes=self._request_attributes(
                verb="ListIdentifiers",
                optional_arguments=("metadataPrefix", "from", "until", "set"),
            ),
            payload=records,
        )

    def _handle_list_records(self) -> OAIResponse:
        self._validate_allowed_arguments({"verb", "metadataPrefix", "from", "until", "set"})
        self._validate_metadata_prefix()
        records = self._list_records(include_metadata=True)
        if not records:
            raise self._request_error("noRecordsMatch", "No matching records were found.")

        return OAIResponse(
            verb="ListRecords",
            request_attributes=self._request_attributes(
                verb="ListRecords",
                optional_arguments=("metadataPrefix", "from", "until", "set"),
            ),
            payload=records,
        )

    def _handle_get_record(self) -> OAIResponse:
        self._validate_allowed_arguments({"verb", "identifier", "metadataPrefix"})
        self._validate_metadata_prefix()
        identifier = self._require_argument("identifier")
        article = self._get_article_for_identifier(identifier)
        record = self._build_record(article, include_metadata=True)

        return OAIResponse(
            verb="GetRecord",
            request_attributes=self._request_attributes(
                verb="GetRecord",
                optional_arguments=("identifier", "metadataPrefix"),
            ),
            payload=record,
        )

    def _list_records(self, *, include_metadata: bool) -> list[OAIRecord]:
        set_spec = self._get_argument("set")
        from_date = self._parse_date_argument("from")
        until_date = self._parse_date_argument("until")
        if from_date and until_date and from_date > until_date:
            raise self._request_error(
                "badArgument",
                "The 'from' argument cannot be later than the 'until' argument.",
            )

        queryset = self._published_articles()
        if set_spec:
            section = self._get_section_for_set(set_spec)
            if section is None:
                raise self._request_error("noRecordsMatch", "The requested set has no records.")
            queryset = queryset.filter(section=section)

        records = []
        for article in queryset:
            datestamp_date = self._article_datestamp_date(article)
            if from_date and datestamp_date < from_date:
                continue
            if until_date and datestamp_date > until_date:
                continue
            records.append(self._build_record(article, include_metadata=include_metadata))

        return records

    def _build_record(self, article: PublishedArticle, *, include_metadata: bool) -> OAIRecord:
        metadata = None
        if include_metadata:
            metadata = ArticleMetadataBuilder(request=self.request).build(article)

        return OAIRecord(
            identifier=self.build_oai_identifier(article.slug, self.repository_identifier),
            datestamp=self._format_datestamp(article),
            set_spec=self.section_set_spec(article.section) if article.section_id else None,
            metadata=metadata,
        )

    def _published_articles(self):
        return (
            PublishedArticle.objects.filter(status=PublishedArticle.Status.PUBLISHED)
            .select_related("section")
            .prefetch_related("authors")
            .order_by("slug")
        )

    def _get_article_for_identifier(self, identifier: str) -> PublishedArticle:
        slug = self._parse_oai_identifier(identifier)
        try:
            return self._published_articles().get(slug=slug)
        except PublishedArticle.DoesNotExist as exc:
            raise self._request_error(
                "idDoesNotExist",
                "The requested identifier does not exist in this repository.",
            ) from exc

    def _parse_oai_identifier(self, identifier: str) -> str:
        pattern = r"^oai:(?P<repository>.+):article:(?P<slug>[-A-Za-z0-9_]+)$"
        match = re.match(pattern, identifier or "")
        if not match or match.group("repository") != self.repository_identifier:
            raise self._request_error(
                "idDoesNotExist",
                "The requested identifier does not exist in this repository.",
            )
        return match.group("slug")

    def _get_section_for_set(self, set_spec: str) -> Optional[Section]:
        for section in Section.objects.filter(is_active=True):
            if self.section_set_spec(section) == set_spec:
                return section
        return None

    def _validate_metadata_prefix(self) -> str:
        metadata_prefix = self._require_argument("metadataPrefix")
        if metadata_prefix != OAI_METADATA_PREFIX:
            raise self._request_error(
                "cannotDisseminateFormat",
                "Only metadataPrefix=oai_dc is supported.",
            )
        return metadata_prefix

    def _validate_allowed_arguments(self, allowed_arguments: set[str]) -> None:
        unexpected = sorted(set(self.params.keys()) - allowed_arguments)
        if unexpected:
            joined = ", ".join(unexpected)
            raise self._request_error(
                "badArgument",
                f"Unsupported argument(s) for this OAI verb: {joined}.",
            )

    def _validate_unique_arguments(self) -> None:
        repeated = sorted(
            key for key in self.params.keys() if len(self.params.getlist(key)) > 1
        )
        if repeated:
            joined = ", ".join(repeated)
            raise self._request_error("badArgument", f"Repeated OAI argument(s): {joined}.")

    def _require_argument(self, name: str) -> str:
        value = self._get_argument(name)
        if value is None or value == "":
            raise self._request_error("badArgument", f"Missing required argument: {name}.")
        return value

    def _get_argument(self, name: str) -> Optional[str]:
        value = self.params.get(name)
        if value is None:
            return None
        return value.strip()

    def _request_attributes(
        self,
        *,
        verb: Optional[str],
        optional_arguments: tuple[str, ...] = (),
    ) -> dict[str, str]:
        attributes = {}
        if verb:
            attributes["verb"] = verb
        for argument in optional_arguments:
            value = self._get_argument(argument)
            if value:
                attributes[argument] = value
        return attributes

    def _parse_date_argument(self, name: str) -> Optional[date]:
        value = self._get_argument(name)
        if not value:
            return None
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            raise self._request_error(
                "badArgument",
                f"The '{name}' argument must use YYYY-MM-DD granularity.",
            )
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise self._request_error(
                "badArgument",
                f"The '{name}' argument is not a valid date.",
            ) from exc

    def _earliest_datestamp(self) -> str:
        article = self._published_articles().order_by(
            "metadata_updated_at",
            "published_at",
            "updated_at",
            "created_at",
        ).first()
        if article is None:
            return timezone.now().date().isoformat()
        return self._format_datestamp(article)

    def _format_datestamp(self, article: PublishedArticle) -> str:
        return self._article_datestamp_date(article).isoformat()

    def _article_datestamp_date(self, article: PublishedArticle) -> date:
        source = (
            article.metadata_updated_at
            or article.published_at
            or getattr(article, "updated_at", None)
            or article.created_at
        )
        if isinstance(source, datetime):
            if timezone.is_naive(source):
                source = source.replace(tzinfo=datetime_timezone.utc)
            return source.astimezone(datetime_timezone.utc).date()
        if isinstance(source, date):
            return source
        return timezone.now().date()

    def _build_oai_base_url(self) -> str:
        base_url = self._clean_text(self.journal_settings.base_url)
        if base_url:
            return urljoin(f"{base_url.rstrip('/')}/", "oai/")
        return self.request.build_absolute_uri("/oai/")

    def _build_repository_identifier(self) -> str:
        source = self._clean_text(self.journal_settings.base_url) or self.request.get_host()
        parsed = urlparse(source if "://" in source else f"//{source}")
        host = parsed.netloc or parsed.path or "ijms.local"
        host = host.split("@")[-1].strip().strip("/").lower()
        identifier = re.sub(r"[^a-z0-9.-]+", "-", host).strip(".-")
        return identifier or "ijms.local"

    @staticmethod
    def build_oai_identifier(slug: str, repository_identifier: str) -> str:
        return f"oai:{repository_identifier}:article:{slug}"

    @staticmethod
    def section_set_spec(section: Section) -> str:
        section_slug = slugify(section.name) or str(section.id)
        return f"section:{section_slug}"

    @staticmethod
    def _clean_text(value) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _error(code: str, message: str) -> OAIError:
        return OAIError(code=code, message=message)

    @classmethod
    def _request_error(cls, code: str, message: str) -> OAIRequestError:
        return OAIRequestError(cls._error(code, message))
