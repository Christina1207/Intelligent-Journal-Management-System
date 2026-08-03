from pathlib import Path
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from apps.integrity.services.pipeline import (
    get_plagiarism_checker,
)


PIPELINE_TEST_SETTINGS = {
    "PLAGIARISM_ENABLED": True,
    "PLAGIARISM_DATABASE_URL": (
        "postgresql://user:password@source-db:5432/source_corpus"
    ),
    "PLAGIARISM_SOURCE_TYPE": "test_source",
    "PLAGIARISM_E5_MODEL_DIRECTORY": Path(
        "/pipeline_resources/models/multilingual-e5-base"
    ),
    "PLAGIARISM_E5_DEVICE": "cpu",
    "PLAGIARISM_E5_BATCH_SIZE": 4,
    "PLAGIARISM_ARAT5_MODEL_DIRECTORY": Path(
        "/pipeline_resources/models/AraT5v2-base-1024"
    ),
    "PLAGIARISM_CHECKPOINT_PATH": Path(
        "/pipeline_resources/models/verifier/"
        "f2_x2_o1_c1/best_model.pt"
    ),
    "PLAGIARISM_CHECKPOINT_ID": (
        "f2_x2_o1_c1/best_model.pt"
    ),
    "PLAGIARISM_SEMANTIC_BACKEND": "local",
    "PLAGIARISM_SEMANTIC_CACHE_DIRECTORY": Path(
        "/pipeline_resources/cache/semantic"
    ),
    "PLAGIARISM_BM25_CACHE_DIRECTORY": Path(
        "/var/cache/ijms-plagiarism/bm25"
    ),
    "PLAGIARISM_LEXICAL_TOP_K": 10,
    "PLAGIARISM_SEMANTIC_TOP_K": 10,
    "PLAGIARISM_DEVICE": "cpu",
    "PLAGIARISM_MIXED_PRECISION": "none",
    "PLAGIARISM_VERIFIER_BATCH_SIZE": 2,
    "PLAGIARISM_VERIFIER_MAX_LENGTH": 512,
    "PLAGIARISM_FORCE_REBUILD_BM25_CACHE": False,
    "PLAGIARISM_MAX_FILE_SIZE_BYTES": 50 * 1024 * 1024,
    "PLAGIARISM_MINIMUM_PDF_USABLE_CHARACTERS": 20,
    "PLAGIARISM_PDF_PAGE_SEPARATOR": "\n\n",
}


@override_settings(**PIPELINE_TEST_SETTINGS)
class PlagiarismPipelineServiceTests(SimpleTestCase):
    def setUp(self):
        get_plagiarism_checker.cache_clear()

    def tearDown(self):
        get_plagiarism_checker.cache_clear()

    @patch(
        "apps.integrity.services.pipeline."
        "FilePlagiarismChecker"
    )
    @patch(
        "apps.integrity.services.pipeline."
        "DocumentIngestionService"
    )
    @patch(
        "apps.integrity.services.pipeline."
        "build_default_local_pipeline"
    )
    def test_builds_checker_from_django_settings(
        self,
        build_pipeline_mock,
        ingestion_service_class_mock,
        checker_class_mock,
    ):
        pipeline = object()
        ingestion_service = object()
        checker = object()

        build_pipeline_mock.return_value = pipeline
        ingestion_service_class_mock.return_value = (
            ingestion_service
        )
        checker_class_mock.return_value = checker

        result = get_plagiarism_checker()

        self.assertIs(result, checker)

        pipeline_config = (
            build_pipeline_mock.call_args.args[0]
        )
        self.assertEqual(
            pipeline_config.source_type,
            "test_source",
        )
        self.assertEqual(
            pipeline_config.e5_model_directory,
            Path(
                "/pipeline_resources/models/"
                "multilingual-e5-base"
            ),
        )
        self.assertEqual(
            pipeline_config.base_model_directory,
            Path(
                "/pipeline_resources/models/"
                "AraT5v2-base-1024"
            ),
        )
        self.assertEqual(
            pipeline_config.checkpoint_path,
            Path(
                "/pipeline_resources/models/verifier/"
                "f2_x2_o1_c1/best_model.pt"
            ),
        )
        self.assertEqual(
            pipeline_config.bm25_cache_directory,
            Path("/var/cache/ijms-plagiarism/bm25"),
        )
        self.assertEqual(
            pipeline_config.verifier_batch_size,
            2,
        )

        ingestion_config = (
            ingestion_service_class_mock
            .call_args
            .args[0]
        )
        self.assertEqual(
            ingestion_config.max_file_size_bytes,
            50 * 1024 * 1024,
        )
        self.assertEqual(
            ingestion_config.minimum_pdf_usable_characters,
            20,
        )

        checker_class_mock.assert_called_once_with(
            pipeline,
            ingestion_service=ingestion_service,
        )

    @patch(
        "apps.integrity.services.pipeline."
        "FilePlagiarismChecker"
    )
    @patch(
        "apps.integrity.services.pipeline."
        "DocumentIngestionService"
    )
    @patch(
        "apps.integrity.services.pipeline."
        "build_default_local_pipeline"
    )
    def test_checker_is_cached_per_process(
        self,
        build_pipeline_mock,
        ingestion_service_class_mock,
        checker_class_mock,
    ):
        checker = object()
        checker_class_mock.return_value = checker

        first = get_plagiarism_checker()
        second = get_plagiarism_checker()

        self.assertIs(first, second)
        build_pipeline_mock.assert_called_once()
        ingestion_service_class_mock.assert_called_once()
        checker_class_mock.assert_called_once()

    @override_settings(PLAGIARISM_ENABLED=False)
    @patch(
        "apps.integrity.services.pipeline."
        "build_default_local_pipeline"
    )
    def test_disabled_pipeline_is_not_built(
        self,
        build_pipeline_mock,
    ):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "Plagiarism detection is disabled",
        ):
            get_plagiarism_checker()

        build_pipeline_mock.assert_not_called()

    @override_settings(PLAGIARISM_SOURCE_TYPE="")
    @patch(
        "apps.integrity.services.pipeline."
        "build_default_local_pipeline"
    )
    def test_source_type_is_required(
        self,
        build_pipeline_mock,
    ):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "PLAGIARISM_SOURCE_TYPE",
        ):
            get_plagiarism_checker()

        build_pipeline_mock.assert_not_called()

    @override_settings(PLAGIARISM_DATABASE_URL="")
    @patch(
        "apps.integrity.services.pipeline."
        "build_default_local_pipeline"
    )
    def test_source_database_url_is_required(
        self,
        build_pipeline_mock,
    ):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "PLAGIARISM_DATABASE_URL",
        ):
            get_plagiarism_checker()

        build_pipeline_mock.assert_not_called()