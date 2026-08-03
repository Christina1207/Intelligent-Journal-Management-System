# Email notifications

The system sends asynchronous transactional email notifications for
important journal workflow events.

## Supported events

| Event                             | Recipient                                   |
| --------------------------------- | ------------------------------------------- |
| Reviewer invitation               | Invited reviewer                            |
| Editor assignment or reassignment | Newly assigned Section Editor               |
| Editorial decision                | Submitting author                           |
| Desk rejection                    | Submitting author                           |
| Revision uploaded                 | Carried-forward reviewers                   |
| Review deadline reminder          | Reviewer with an incomplete accepted review |
| Article published                 | Submitting author                           |

Only the submitting/corresponding author receives author-facing email in
the current implementation.

## Architecture

Business services register Celery task dispatches through
`transaction.on_commit()`.

This ensures that an email is not queued until the associated workflow
change has committed successfully. Email delivery failure does not roll
back editorial actions.

The existing Celery worker sends email, while Celery Beat identifies
review assignments that are approaching their deadlines.

## Development configuration

Development uses Django's console email backend by default:

```text
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```
