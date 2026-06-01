from .models import Submission


class SubmissionService:

    @staticmethod
    def create_submission(author, validated_data: dict) -> Submission:
        """
        TODO: check if author is being recognized from the JWT token
        Create a new submission owned by the given author.
        Status is always SUBMITTED on creation — never trust client-provided status.
        """
        return Submission.objects.create(
            author=author,
            status=Submission.Status.SUBMITTED,
            **validated_data,
        )