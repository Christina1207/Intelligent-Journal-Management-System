from datetime import datetime, timezone as datetime_timezone
import xml.etree.ElementTree as ET

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.journals.models import JournalMetadataSettings, Section
from apps.publishing.exporters import DC_NAMESPACE, OAI_DC_NAMESPACE
from apps.publishing.models import PublishedArticle, PublishedArticleAuthor
from apps.submissions.models import Submission

from .renderers import OAI_NAMESPACE
from .services import OAIProviderService


class OAIProviderEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = get_user_model().objects.create_user(
            username="oai-author",
            email="oai-author@example.com",
            password="testpass123",
            first_name="OAI",
            last_name="Author",
        )
        self.section = Section.objects.create(name="Computer Science")
        self.other_section = Section.objects.create(name="Medical Informatics")
        self.inactive_section = Section.objects.create(
            name="Inactive Archives",
            is_active=False,
        )
        JournalMetadataSettings.objects.update_or_create(
            pk=JournalMetadataSettings.SINGLETON_PK,
            defaults={
                "journal_title": "Intelligent Journal",
                "publisher_name": "Open Publishing Lab",
                "base_url": "https://journal.example.org",
                "default_language": "en",
                "oai_repository_name": "IJMS OAI Repository",
                "oai_admin_email": "metadata-admin@example.org",
            },
        )

    def test_identify_returns_repository_metadata_as_parseable_xml(self):
        self._create_article(slug="identify-article")

        response, root = self._get_oai("/oai?verb=Identify")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml; charset=utf-8")
        self.assertEqual(
            self._text(root, "Identify/repositoryName"),
            "IJMS OAI Repository",
        )
        self.assertEqual(self._text(root, "Identify/protocolVersion"), "2.0")
        self.assertEqual(
            self._text(root, "Identify/adminEmail"),
            "metadata-admin@example.org",
        )
        self.assertRegex(
            self._text(root, "Identify/earliestDatestamp"),
            r"^\d{4}-\d{2}-\d{2}$",
        )
        self.assertEqual(self._text(root, "Identify/granularity"), "YYYY-MM-DD")

    def test_list_metadata_formats_returns_oai_dc_only(self):
        response, root = self._get_oai("/oai?verb=ListMetadataFormats")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._text(root, "ListMetadataFormats/metadataFormat/metadataPrefix"),
            "oai_dc",
        )
        self.assertEqual(
            self._text(root, "ListMetadataFormats/metadataFormat/schema"),
            "http://www.openarchives.org/OAI/2.0/oai_dc.xsd",
        )
        self.assertEqual(
            self._text(root, "ListMetadataFormats/metadataFormat/metadataNamespace"),
            "http://www.openarchives.org/OAI/2.0/oai_dc/",
        )

    def test_unsupported_metadata_prefix_returns_oai_error(self):
        response, root = self._get_oai("/oai?verb=ListRecords&metadataPrefix=jats")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml; charset=utf-8")
        self.assertEqual(self._error_code(root), "cannotDisseminateFormat")

    def test_list_sets_returns_active_sections_as_safe_set_specs(self):
        response, root = self._get_oai("/oai?verb=ListSets")

        self.assertEqual(response.status_code, 200)
        set_specs = [
            element.text
            for element in root.findall(
                f".//{{{OAI_NAMESPACE}}}ListSets/"
                f"{{{OAI_NAMESPACE}}}set/"
                f"{{{OAI_NAMESPACE}}}setSpec"
            )
        ]
        set_names = [
            element.text
            for element in root.findall(
                f".//{{{OAI_NAMESPACE}}}ListSets/"
                f"{{{OAI_NAMESPACE}}}set/"
                f"{{{OAI_NAMESPACE}}}setName"
            )
        ]

        self.assertIn("section:computer-science", set_specs)
        self.assertIn("section:medical-informatics", set_specs)
        self.assertNotIn("section:inactive-archives", set_specs)
        self.assertIn("Computer Science", set_names)
        self.assertNotIn("Inactive Archives", set_names)

    def test_list_identifiers_returns_headers_without_metadata(self):
        article = self._create_article(slug="identifier-article")

        response, root = self._get_oai(
            "/oai?verb=ListIdentifiers&metadataPrefix=oai_dc"
        )

        self.assertEqual(response.status_code, 200)
        header = root.find(f".//{{{OAI_NAMESPACE}}}header")
        self.assertIsNotNone(header)
        self.assertEqual(
            header.find(f"{{{OAI_NAMESPACE}}}identifier").text,
            self._identifier(article),
        )
        self.assertRegex(
            header.find(f"{{{OAI_NAMESPACE}}}datestamp").text,
            r"^\d{4}-\d{2}-\d{2}$",
        )
        self.assertEqual(
            header.find(f"{{{OAI_NAMESPACE}}}setSpec").text,
            "section:computer-science",
        )
        self.assertIsNone(root.find(f".//{{{OAI_NAMESPACE}}}metadata"))

    def test_list_identifiers_set_filter_returns_matching_section_only(self):
        matching = self._create_article(
            slug="matching-identifier",
            section=self.section,
        )
        other = self._create_article(
            slug="other-identifier",
            section=self.other_section,
        )

        response, root = self._get_oai(
            "/oai?verb=ListIdentifiers&metadataPrefix=oai_dc"
            "&set=section:computer-science"
        )

        self.assertEqual(response.status_code, 200)
        identifiers = self._identifiers(root)
        self.assertEqual(identifiers, [self._identifier(matching)])
        self.assertNotIn(self._identifier(other), identifiers)

    def test_list_identifiers_unknown_set_returns_no_records_match(self):
        self._create_article(slug="unknown-set-source")

        response, root = self._get_oai(
            "/oai?verb=ListIdentifiers&metadataPrefix=oai_dc&set=section:missing"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._error_code(root), "noRecordsMatch")

    def test_list_identifiers_supports_from_and_until_date_filters(self):
        old_article = self._create_article(slug="old-datestamp")
        matching_article = self._create_article(slug="matching-datestamp")
        self._set_datestamp(old_article, datetime(2026, 1, 10, tzinfo=datetime_timezone.utc))
        self._set_datestamp(
            matching_article,
            datetime(2026, 2, 15, tzinfo=datetime_timezone.utc),
        )

        response, root = self._get_oai(
            "/oai?verb=ListIdentifiers&metadataPrefix=oai_dc"
            "&from=2026-02-01&until=2026-02-28"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._identifiers(root), [self._identifier(matching_article)])

    def test_list_records_returns_headers_and_embedded_dublin_core(self):
        article = self._create_article(
            slug="record-article",
            title="Published OAI Article",
            abstract="A public article exposed to OAI harvesters.",
        )
        self._create_article(
            slug="draft-record",
            status=PublishedArticle.Status.DRAFT,
            title="Hidden Draft OAI Article",
        )
        self._create_article(
            slug="retracted-record",
            status=PublishedArticle.Status.RETRACTED,
            title="Hidden Retracted OAI Article",
        )

        response, root = self._get_oai("/oai?verb=ListRecords&metadataPrefix=oai_dc")

        self.assertEqual(response.status_code, 200)
        records = root.findall(f".//{{{OAI_NAMESPACE}}}record")
        self.assertEqual(len(records), 1)
        self.assertEqual(self._identifiers(root), [self._identifier(article)])
        self.assertIsNotNone(root.find(f".//{{{OAI_DC_NAMESPACE}}}dc"))
        self.assertEqual(
            root.find(f".//{{{DC_NAMESPACE}}}title").text,
            "Published OAI Article",
        )
        content = response.content.decode("utf-8")
        self.assertNotIn("Hidden Draft OAI Article", content)
        self.assertNotIn("Hidden Retracted OAI Article", content)

    def test_list_records_set_filter_returns_matching_records_only(self):
        matching = self._create_article(slug="matching-record", section=self.section)
        other = self._create_article(slug="other-record", section=self.other_section)

        response, root = self._get_oai(
            "/oai?verb=ListRecords&metadataPrefix=oai_dc"
            "&set=section:medical-informatics"
        )

        self.assertEqual(response.status_code, 200)
        identifiers = self._identifiers(root)
        self.assertEqual(identifiers, [self._identifier(other)])
        self.assertNotIn(self._identifier(matching), identifiers)

    def test_get_record_returns_one_record_for_valid_identifier(self):
        article = self._create_article(slug="get-record-article")

        response, root = self._get_oai(
            "/oai?verb=GetRecord"
            f"&identifier={self._identifier(article)}"
            "&metadataPrefix=oai_dc"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(root.findall(f".//{{{OAI_NAMESPACE}}}record")), 1)
        self.assertEqual(self._identifiers(root), [self._identifier(article)])
        self.assertIsNotNone(root.find(f".//{{{OAI_DC_NAMESPACE}}}dc"))

    def test_get_record_preserves_safe_academic_metadata(self):
        article = self._create_article(
            slug="academic-metadata-record",
            title="Responsible AI for Scientific Publishing",
            abstract=(
                "An evaluation of responsible machine-assisted "
                "editorial workflows."
            ),
            language="en",
        )

        primary_author = article.authors.get(order=1)
        primary_author.full_name = "Ada Lovelace"
        primary_author.orcid = "0000-0000-0000-0001"
        primary_author.affiliation = "Analytical Engine Institute"
        primary_author.save(
            update_fields=[
                "full_name",
                "orcid",
                "affiliation",
            ]
        )

        PublishedArticleAuthor.objects.create(
            article=article,
            full_name="Alan Turing",
            email="alan.private@example.org",
            orcid="0000-0002-1825-0097",
            affiliation="Computing Laboratory",
            country="United Kingdom",
            order=2,
            is_corresponding=False,
        )

        response, root = self._get_oai(
            "/oai?verb=GetRecord"
            f"&identifier={self._identifier(article)}"
            "&metadataPrefix=oai_dc"
        )

        self.assertEqual(response.status_code, 200)

        creators = [
            element.text
            for element in root.findall(
                f".//{{{DC_NAMESPACE}}}creator"
            )
        ]
        subjects = [
            element.text
            for element in root.findall(
                f".//{{{DC_NAMESPACE}}}subject"
            )
        ]
        identifiers = [
            element.text
            for element in root.findall(
                f".//{{{DC_NAMESPACE}}}identifier"
            )
        ]
        language = root.find(
            f".//{{{DC_NAMESPACE}}}language"
        )

        self.assertEqual(
            creators,
            ["Ada Lovelace", "Alan Turing"],
        )
        self.assertEqual(subjects, ["oai", "metadata"])
        self.assertIsNotNone(language)
        self.assertEqual(language.text, "en")

        self.assertIn(
            "https://doi.org/10.5555/academic-metadata-record",
            identifiers,
        )
        self.assertIn(
            "https://journal.example.org/api/v1/public/articles/"
            "academic-metadata-record/",
            identifiers,
        )

        # Email addresses are not part of the public oai_dc record.
        xml = response.content.decode("utf-8")
        self.assertNotIn("snapshot@example.org", xml)
        self.assertNotIn("alan.private@example.org", xml)

    def test_get_record_unknown_identifier_returns_id_does_not_exist(self):
        response, root = self._get_oai(
            "/oai?verb=GetRecord"
            "&identifier=oai:journal.example.org:article:unknown"
            "&metadataPrefix=oai_dc"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._error_code(root), "idDoesNotExist")

    def test_get_record_unsupported_prefix_returns_oai_error(self):
        article = self._create_article(slug="unsupported-prefix-record")

        response, root = self._get_oai(
            "/oai?verb=GetRecord"
            f"&identifier={self._identifier(article)}"
            "&metadataPrefix=mods"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._error_code(root), "cannotDisseminateFormat")

    def test_get_record_does_not_return_draft_or_retracted_identifiers(self):
        draft = self._create_article(
            slug="draft-get-record",
            status=PublishedArticle.Status.DRAFT,
        )
        retracted = self._create_article(
            slug="retracted-get-record",
            status=PublishedArticle.Status.RETRACTED,
        )

        for article in [draft, retracted]:
            with self.subTest(slug=article.slug):
                response, root = self._get_oai(
                    "/oai?verb=GetRecord"
                    f"&identifier={self._identifier(article)}"
                    "&metadataPrefix=oai_dc"
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(self._error_code(root), "idDoesNotExist")

    def test_general_errors_are_oai_xml(self):
        scenarios = [
            ("/oai", "badVerb"),
            ("/oai?verb=Unknown", "badVerb"),
            ("/oai?verb=Identify&metadataPrefix=oai_dc", "badArgument"),
        ]

        for path, expected_code in scenarios:
            with self.subTest(path=path):
                response, root = self._get_oai(path)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response["Content-Type"],
                    "application/xml; charset=utf-8",
                )
                self.assertEqual(self._error_code(root), expected_code)

    def test_oai_dublin_core_preserves_arabic_utf8_metadata(self):
        title = "تحليل دلالي للمقالات العلمية"
        abstract = "ملخص عربي لاختبار واجهة OAI."
        self._create_article(
            slug="arabic-oai-record",
            title=title,
            abstract=abstract,
            language="ar",
        )

        response, root = self._get_oai("/oai?verb=ListRecords&metadataPrefix=oai_dc")

        self.assertEqual(response.status_code, 200)
        self.assertIn(title, response.content.decode("utf-8"))
        self.assertIn(abstract, response.content.decode("utf-8"))
        self.assertEqual(root.find(f".//{{{DC_NAMESPACE}}}title").text, title)
        self.assertEqual(
            root.find(f".//{{{DC_NAMESPACE}}}description").text,
            abstract,
        )

    def _create_article(
        self,
        *,
        slug,
        section=None,
        status=PublishedArticle.Status.PUBLISHED,
        title=None,
        abstract="A published article for OAI-PMH tests.",
        language="en",
        published_at=None,
    ):
        section = section or self.section
        submission = Submission.objects.create(
            title=f"Submission for {slug}",
            abstract="Original submission abstract.",
            language=language,
            author=self.author,
            section=section,
            status=Submission.Status.ACCEPTED,
        )
        if published_at is None and status == PublishedArticle.Status.PUBLISHED:
            published_at = timezone.now()

        article = PublishedArticle.objects.create(
            submission=submission,
            section=section,
            title=title or f"Article {slug}",
            slug=slug,
            abstract=abstract,
            language=language,
            keywords=["oai", "metadata"],
            doi=f"10.5555/{slug}",
            status=status,
            published_at=published_at,
        )
        PublishedArticleAuthor.objects.create(
            article=article,
            full_name="Snapshot Author",
            email="snapshot@example.org",
            order=1,
            is_corresponding=True,
        )
        return article

    def _set_datestamp(self, article, datestamp):
        PublishedArticle.objects.filter(pk=article.pk).update(
            metadata_updated_at=datestamp,
            updated_at=datestamp,
        )
        article.refresh_from_db()

    def _get_oai(self, path):
        response = self.client.get(path)
        root = ET.fromstring(response.content.decode("utf-8"))
        return response, root

    def _identifier(self, article):
        return OAIProviderService.build_oai_identifier(
            article.slug,
            "journal.example.org",
        )

    def _identifiers(self, root):
        return [
            element.text
            for element in root.findall(f".//{{{OAI_NAMESPACE}}}identifier")
        ]

    def _text(self, root, path):
        namespaced_path = "/".join(f"{{{OAI_NAMESPACE}}}{part}" for part in path.split("/"))
        element = root.find(namespaced_path)
        self.assertIsNotNone(element)
        return element.text

    def _error_code(self, root):
        error = root.find(f"{{{OAI_NAMESPACE}}}error")
        self.assertIsNotNone(error)
        return error.attrib["code"]
