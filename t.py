from apps.accounts.models import ReviewerProfile, Role, User
from apps.submissions.models import Submission, SubmissionTopic

submission = Submission.objects.get(
    pk="98a704ee-4441-4a14-b022-eab67949162b"
)

print("Submission:", submission.title)
print("Section:", submission.section)
print("Author keywords:", submission.keywords)
print("Has embedding:", bool(submission.abstract_embedding))
print(
    "Topic:",
    SubmissionTopic.objects.filter(
        submission=submission
    ).values("label", "keywords").first(),
)

profiles = (
    ReviewerProfile.objects.filter(
        sections=submission.section,
        user__status=User.Status.ACTIVE,
        user__roles__name=Role.RoleName.REVIEWER,
    )
    .select_related("user")
    .distinct()
)

for profile in profiles:
    print(
        profile.user.email,
        "keywords=", profile.keywords,
        "sync=", profile.sync_status,
        "embedding=", bool(profile.expertise_embedding),
    )