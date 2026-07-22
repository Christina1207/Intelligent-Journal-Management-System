from uuid import UUID

from django.test import SimpleTestCase
from django.urls import reverse


class ApiUrlContractTests(SimpleTestCase):
    def test_public_url_contract_is_preserved(self):
        submission_id = UUID(
            "11111111-1111-1111-1111-111111111111"
        )
        assignment_id = UUID(
            "22222222-2222-2222-2222-222222222222"
        )
        article_id = UUID(
            "33333333-3333-3333-3333-333333333333"
        )

        cases = [
            (
                "oai-pmh",
                (),
                "/oai",
            ),
            (
                "schema",
                (),
                "/api/v1/schema/",
            ),
            (
                "swagger-ui",
                (),
                "/api/v1/docs/",
            ),
            (
                "auth-register",
                (),
                "/api/v1/auth/register/",
            ),
            (
                "section-list",
                (),
                "/api/v1/sections/sections/",
            ),
            (
                "submission-create",
                (),
                "/api/v1/submissions/",
            ),
            (
                "manager-queue",
                (),
                "/api/v1/manager/queue/",
            ),
            (
                "editor-queue",
                (),
                "/api/v1/editor/queue/",
            ),
            (
                "editor-reviews:submission-reviews",
                (submission_id,),
                (
                    "/api/v1/editor/submissions/"
                    f"{submission_id}/reviews/"
                ),
            ),
            (
                "reviewer:my-assignments",
                (),
                "/api/v1/reviewer/assignments/",
            ),
            (
                "reviewer:reviewer-manuscript-download",
                (assignment_id,),
                (
                    "/api/v1/reviewer/assignments/"
                    f"{assignment_id}/manuscript/"
                ),
            ),
            (
                "publishing-article-detail",
                (article_id,),
                (
                    "/api/v1/publishing/articles/"
                    f"{article_id}/"
                ),
            ),
            (
                "public-article-download",
                ("sample-article",),
                (
                    "/api/v1/public/articles/"
                    "sample-article/download/"
                ),
            ),
        ]

        for route_name, args, expected_path in cases:
            with self.subTest(route_name=route_name):
                self.assertEqual(
                    reverse(route_name, args=args),
                    expected_path,
                )