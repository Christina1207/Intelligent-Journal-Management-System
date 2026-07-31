# Journal Customization

## Scope

The Intelligent Journal Management System uses a single-journal-per-deployment design.

An institution can customize the journal without modifying application source code. The system does not implement multi-tenancy, arbitrary workflow construction, or dynamically defined security roles.

## Administration interface

Journal configuration is managed through Django admin:

```text
/admin/
```

The configuration administrator must be a Django staff user with the necessary model permissions.

The application-level `ADMIN` role does not automatically grant Django admin access.

## Journal identity

Open:

```text
Journals → Journal metadata settings
```

The following values are configurable:

- Journal title
- Short name
- Description
- Publisher
- Logo
- Primary color
- Print ISSN
- Online ISSN
- Base URL
- Default language
- Default publication license
- Access policy
- Peer-review policy
- Publication frequency
- OAI-PMH metadata

Only one journal metadata record is permitted per deployment.

The primary color must use the `#RRGGBB` format.

## Public information and policy pages

Open:

```text
Journals → Journal content pages
```

The supported pages are:

- About the Journal
- Author Guidelines
- Publication Ethics
- Open Access

Pages are stored as plain text. Lines beginning with `#`, `##`, or `###` are displayed as headings.

Draft pages are not publicly accessible. A page becomes public only when `is_published` is enabled.

## Scientific departments

Scientific departments are represented by the `Section` model.

An institution can:

- Create sections
- Update section names and descriptions
- Assign section managers
- Assign eligible section editors
- Activate sections
- Deactivate sections

Inactive sections cannot receive new submissions. Existing submissions retain their historical section.

Sections containing historical editorial data should be deactivated rather than deleted.

## Roles and permissions

The workflow uses predefined semantic roles:

- `AUTHOR`
- `REVIEWER`
- `SECTION_MANAGER`
- `SECTION_EDITOR`
- `EDITOR_IN_CHIEF`
- `ADMIN`
- `READER`

Institutions can configure:

- Which users possess each role
- Whether a user possesses multiple roles
- Which section a manager manages
- Which sections an editor or reviewer belongs to
- Whether an account is active

Institutions cannot redefine the meaning of workflow roles or create arbitrary permission semantics. Core permission behavior remains part of the tested application logic.

Create missing predefined roles with:

```bash
python manage.py seed_roles
```

## Workflow policies

The following workflow rules can be configured through environment variables:

- `REQUIRED_REVIEWS_COUNT`: Number of completed reviews required before an editorial decision.
- `MAX_REVISION_ROUNDS`: Maximum number of revision rounds allowed for a submission.
- `REVISION_REVIEW_DEADLINE_DAYS`: Default review deadline for a revised manuscript.

These settings affect all submissions in the deployment. They are not configurable separately for individual journals or sections.

After changing them, restart the backend and Celery services.

## Development and production media handling

In development, Django serves uploaded journal logos from `/media/` when `DEBUG=True`.

Production deployments should serve media files through the production web server or a configured object-storage service.

## Verification

After changing journal configuration:

1. Refresh the public portal.
2. Confirm the journal name and logo are displayed.
3. Confirm the configured primary color is applied.
4. Confirm browser titles use the configured journal name.
5. Confirm published policy pages are accessible.
6. Confirm draft policy pages return `404`.
7. Confirm inactive sections are unavailable for new submissions.
8. Confirm role-based editorial permissions still apply.
