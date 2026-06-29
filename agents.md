# AGENTS.md

This file provides instructions for AI coding assistants working on this repository.

The goal is to ensure that generated code follows good software engineering practices, remains consistent with the project architecture, and supports the long-term maintainability of the system.

## Project Overview

This project is an intelligent journal management system for peer-reviewed scientific journals.

It supports the full scientific publishing workflow:

**Submission → Review → Evaluation → Publishing**

The system also integrates artificial intelligence and scientific text analysis techniques to support editorial decision-making and improve the quality of the publishing process.

This project is developed as a graduation project in Software and Artificial Intelligence Engineering. Although it is an academic project, the codebase should be treated as a professional software engineering project.

## Project Objective

The objective of this project is to develop an open-source electronic system for managing peer-reviewed scientific journals.

The system should be reusable and customizable so that different academic journals or university institutions can deploy it without needing to redevelop the system from scratch.

The system focuses on:

- Managing the full scientific publishing life cycle
- Supporting editors, reviewers, authors, and administrators
- Improving editorial decision-making using AI-based tools
- Supporting research ethics and academic integrity
- Providing a configurable platform for different journals and institutions
- Demonstrating strong software engineering practices

## Main Capabilities

The system should support the following main capabilities:

- User and role management
- Electronic paper submission
- Metadata entry and manuscript upload
- Peer-review workflow
- Double-blind review support
- Multiple review rounds
- Submission versioning
- Reviewer assignment
- Review reports
- Editorial decisions
- Copyediting workflow
- Electronic publishing
- Issue archiving
- Plagiarism detection
- Reviewer recommendation
- Topic modeling
- Semantic matching
- Intelligent paper ranking or prioritization
- Metadata extraction using machine learning
- Analytical dashboards
- Journal customization

## Academic and Technical Requirements

The implementation must stay aligned with the mentor-specified technical concepts of the project.

### Software Engineering Requirements

The codebase should demonstrate:

- Functional and non-functional requirements analysis
- Study and evaluation of existing open-source systems, especially Open Journal Systems (OJS)
- Component-based software engineering
- Quality assurance and testing
- System documentation and user manuals
- Engineering of reusable systems
- Separation of configuration from application logic, also known as Configuration vs. Code
- Design of customizable systems

When making design decisions, prefer solutions that make the system reusable, configurable, maintainable, and understandable.

### Artificial Intelligence Requirements

The AI-related parts of the system should support:

- Plagiarism detection
- Natural Language Processing (NLP) for analyzing research titles and abstracts
- Topic modeling for automated research topic extraction
- Reviewer recommendation systems
- Semantic matching between research papers and reviewer expertise
- Intelligent paper ranking or prioritization
- Metadata extraction using Machine Learning (ML)

AI features should be implemented incrementally and should support human editorial decision-making rather than replace it.

### Supporting Requirements

The system should also address:

- Scientific publishing workflows
- Research ethics
- Digital content management
- User Experience (UX) for editors and researchers

These requirements should influence workflow design, access control, review management, publication management, and interface design.

## Expected Technology Stack

### Backend

- Django
- Django REST Framework
- PostgreSQL
- pgvector
- Celery
- Redis
- MinIO
- drf-spectacular

### Frontend

- Next.js
- React

### Artificial Intelligence and NLP

- Python-based NLP modules
- Sentence embeddings
- Topic modeling
- Semantic similarity
- Plagiarism detection components
- Metadata extraction components

## Architecture Style

The project should follow a **modular monolith** architecture.

Do not create microservices unless explicitly requested.

The system should be organized into clear domain-based modules. Each module should be responsible for a specific part of the journal management system.

Suggested backend apps:

- `accounts`: users, roles, permissions, authentication-related models
- `journals`: journal configuration, sections, issues, publishing settings
- `submissions`: submissions, submission versions, co-authors, manuscript files
- `reviews`: review assignments, reviewer invitations, review reports
- `workflow`: editorial workflow orchestration and state transitions
- `publishing`: published articles, issue assignment, public metadata
- `ai_services`: plagiarism detection, reviewer recommendation, topic modeling, metadata extraction, analytics support

The AI components should be modular and isolated enough that they can later be extracted into separate services if needed.

## General Coding Rules

Follow these rules when modifying the repository:

1. Make small, focused changes.
2. Do not rewrite unrelated files.
3. Do not introduce large architectural changes without explaining them first.
4. Prefer readable and explicit code over overly clever abstractions.
5. Do not hardcode secrets, passwords, tokens, or environment-specific values.
6. Use environment variables for configuration.
7. Keep naming consistent across the project.
8. Add tests for meaningful backend behavior.
9. Update documentation when adding or changing important features.
10. Explain what changed after completing a task.
11. Avoid unnecessary dependencies.
12. Avoid premature abstractions.
13. Preserve existing behavior unless the task explicitly requires changing it.
14. Do not mix unrelated features in one implementation.

## Backend Design Rules

For Django and Django REST Framework:

1. Keep views thin.
2. Put business logic in services or domain-specific modules when appropriate.
3. Use serializers for input validation and output representation.
4. Use permission classes for role-based access control.
5. Avoid placing complex workflow logic directly inside views or serializers.
6. Use model methods only for behavior that clearly belongs to the model.
7. Use transactions for multi-step operations that must remain consistent.
8. Register important models in the Django admin when useful.
9. Add migrations when models change.
10. Avoid circular dependencies between apps.
11. Keep API responses consistent.
12. Validate user input carefully.
13. Use clear error messages.
14. Prefer explicit permission checks over hidden assumptions.
15. Do not expose internal IDs, reviewer identities, or private editorial data unless intended.

## Frontend Design Rules

For Next.js and React:

1. Keep components focused and reusable.
2. Separate UI components from data-fetching logic where practical.
3. Use clear naming for components, hooks, and services.
4. Avoid duplicating API logic across many components.
5. Handle loading, empty, success, and error states.
6. Keep forms validated and user-friendly.
7. Respect role-based UI behavior.
8. Do not rely only on frontend checks for security.
9. Prefer accessible and understandable interfaces.
10. Keep the user experience suitable for authors, reviewers, editors, and administrators.

## Database Design Rules

The database design should support a real editorial workflow.

When creating or modifying models:

1. Use clear relationships between users, roles, submissions, reviews, and publishing entities.
2. Preserve submission history.
3. Preserve review history.
4. Support multiple submission versions.
5. Support multiple review rounds.
6. Avoid overwriting important editorial decisions.
7. Use appropriate constraints where needed.
8. Use indexes for frequently queried fields.
9. Consider future reporting and dashboard requirements.
10. Avoid storing derived data unless there is a clear reason.
11. Keep configurable values separate from hardcoded logic.

## Workflow Design Rules

The editorial workflow is central to the system.

When implementing workflow-related features:

1. Preserve submission history.
2. Support multiple review rounds.
3. Support multiple submission versions.
4. Do not overwrite previous review decisions or review reports.
5. Keep reviewer identity protected in double-blind review scenarios.
6. Make state transitions explicit and controlled.
7. Avoid allowing arbitrary status changes without validation.
8. Prefer service methods for workflow transitions.
9. Record important timestamps.
10. Record the actor responsible for important workflow actions where appropriate.
11. Keep decisions auditable.
12. Prevent unauthorized users from performing editorial actions.

Examples of workflow transitions:

- Draft → Submitted
- Submitted → Under Review
- Under Review → Revision Requested
- Revision Requested → Revised Submission Uploaded
- Under Review → Accepted
- Under Review → Rejected
- Accepted → Copyediting
- Copyediting → Published

Workflow transition logic should not be scattered across views, serializers, and models. Prefer a clear workflow service or domain module.

## User and Role Management Rules

The system should support multiple user roles involved in journal publishing.

Expected roles include:

- Author / Researcher
- Reviewer
- Section Editor
- Section Manager
- Editor-in-Chief
- Copyeditor
- System Administrator
- Reader

A user may have more than one role.

When implementing role-based access control:

1. Do not hardcode permissions in many unrelated places.
2. Prefer a clear and maintainable permission structure.
3. Keep system roles understandable.
4. Ensure users can access only the submissions, reviews, and editorial tasks they are allowed to access.
5. Do not reveal reviewer identities in double-blind review workflows.
6. Make permission tests part of the backend test suite.

## Submission Rules

Submissions are one of the core entities of the system.

A submission should support:

- Title
- Abstract
- Keywords
- Language
- Author information
- Co-author information
- Manuscript file
- Metadata
- Current status
- Submission history
- Submission versions
- Assigned section
- Review rounds
- Editorial decisions

When implementing submissions:

1. Do not treat a revised manuscript as a completely unrelated submission.
2. Use submission versions to preserve the history of revisions.
3. Keep metadata structured.
4. Avoid losing previous manuscript files.
5. Ensure authors can only modify submissions when the workflow allows it.
6. Ensure editors can track changes across versions.

## Review Rules

The review process should support scientific peer review.

The system should support:

- Reviewer invitations
- Review assignment status
- Review deadlines
- Review reports
- Reviewer recommendations
- Comments for authors
- Confidential comments for editors
- Review decisions
- Multiple review rounds
- Double-blind review where required

When implementing reviews:

1. Separate reviewer assignment from review report submission.
2. Preserve review reports.
3. Preserve review deadlines and statuses.
4. Allow editors to track reviewer responses.
5. Do not expose confidential editor comments to authors.
6. Do not expose reviewer identity in double-blind mode.
7. Ensure only assigned reviewers can submit review reports.

## Publishing Rules

Publishing should happen only after editorial acceptance and any required copyediting steps.

Published articles may include:

- Title
- Abstract
- Authors
- DOI or identifier if available
- Publication date
- Issue
- PDF file
- Metadata for indexing
- View and download statistics

When implementing publishing:

1. Do not publish rejected or unaccepted submissions.
2. Keep a relationship between the published article and the original accepted submission.
3. Preserve article metadata.
4. Support issue-based archiving.
5. Consider standard metadata export requirements.

## AI Feature Rules

AI features should support editors and reviewers, not replace human editorial decisions.

When implementing AI features:

1. Keep AI logic separate from core workflow logic.
2. Store AI results as recommendations, scores, explanations, or analysis outputs.
3. Do not automatically reject or accept papers based only on AI output.
4. Make AI results explainable where possible.
5. Keep room for human override.
6. Design AI features so they can be improved later.
7. Avoid tightly coupling the main system to one specific model or library.
8. Make AI features optional where possible.
9. Keep AI processing asynchronous when it is expensive.
10. Store enough metadata to allow results to be reviewed later.

Important AI modules may include:

- Plagiarism detection
- Topic modeling
- Reviewer recommendation
- Semantic matching
- Research trend analysis
- Metadata extraction
- Submission prioritization

## Reviewer Recommendation Rules

Reviewer recommendation should consider:

- Submission title
- Submission abstract
- Extracted topics
- Reviewer expertise
- Reviewer workload
- Conflict of interest indicators if available
- Previous review history
- Availability

The first implementation may use simple semantic similarity or a weighted heuristic. More advanced models can be added later.

Reviewer recommendation output should be treated as a ranked list of suggestions, not as an automatic assignment.

## Plagiarism Detection Rules

Plagiarism detection should be treated as an initial screening tool.

The system should:

- Store similarity scores or plagiarism indicators.
- Provide evidence or matched sections when possible.
- Allow editors to review the results.
- Avoid making final academic integrity decisions automatically.
- Preserve plagiarism check history.
- Support future improvement of the detection method.

Arabic plagiarism detection is an important target use case, so future implementations should consider Arabic NLP challenges such as:

- Text normalization
- Morphology
- Stemming or lemmatization
- Diacritics
- Paraphrasing
- Semantic similarity
- Citation and quotation handling

## Topic Modeling Rules

Topic modeling should be used to:

- Extract topics from submission titles and abstracts.
- Cluster submissions into thematic groups.
- Support reviewer recommendation.
- Power dashboard insights.
- Help identify publishing trends.

The first implementation can be simple and incremental.

Topic modeling output should be stored in a way that allows future improvement or replacement of the model.

## Intelligent Ranking and Prioritization Rules

The system may include an intelligent paper ranking or prioritization feature.

The first implementation should preferably be a transparent weighted heuristic rather than an opaque complex model.

Ranking factors may include:

- Submission completeness
- Topic relevance
- Editorial priority
- Reviewer availability
- Review deadline urgency
- Similarity to journal scope
- Number of pending submissions in the same section

The ranking result should help editors prioritize work. It should not automatically determine acceptance or rejection.

## Metadata Extraction Rules

Metadata extraction may be used to assist with paper submission and indexing.

Possible extracted metadata includes:

- Title
- Abstract
- Keywords
- Author names
- Affiliations
- References
- Language
- Research topics

Extracted metadata should be reviewable and editable by humans.

Do not assume machine-extracted metadata is always correct.

## Dashboard and Analytics Rules

Dashboards should support editors and administrators by showing useful indicators.

Possible indicators include:

- Number of submissions
- Submission status distribution
- Average review duration
- Reviewer workload
- Acceptance and rejection rates
- Active research topics
- Publishing trends
- Section-level statistics
- Delayed reviews
- Published article counts

Analytics should be based on reliable stored data and should respect access control.

## Customization Rules

This project should support different journals and institutions.

Avoid hardcoding:

- Journal name
- Journal logo
- Editorial policies
- Section names
- Role names where possible
- Review deadlines
- Publishing settings
- Email templates
- Visual identity
- Scientific departments

Prefer configurable models, settings, or admin-managed values.

Configuration should be separated from application logic whenever possible.

## Documentation Rules

Update documentation when a task changes:

- Architecture
- Setup steps
- API behavior
- Workflow behavior
- Environment variables
- Development conventions
- User roles
- Permissions
- AI feature behavior

Documentation should be clear enough for another developer, professor, or future maintainer to understand the system.

Important documentation files may include:

- `README.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `DECISIONS.md`
- `CONTRIBUTING.md`
- `docs/workflow.md`
- `docs/api-guidelines.md`
- `docs/user-roles.md`
- `docs/ai/reviewer-recommendation.md`
- `docs/ai/plagiarism-detection.md`
- `docs/ai/topic-modeling.md`

## Testing Rules

For backend features, include tests where practical.

Tests should cover:

- Model behavior
- Serializer validation
- API permissions
- Workflow transitions
- Role-based access control
- Important service functions
- Review assignment rules
- Submission versioning
- Double-blind review restrictions
- AI service outputs where practical

Before finishing a backend task, check whether the following commands should pass:

```bash
python manage.py test
```

```bash
python manage.py makemigrations --check --dry-run
```

For frontend features, test or manually verify:

- Correct rendering
- Form validation
- API integration
- Loading states
- Error states
- Role-based visibility
- Accessibility basics

## Security Rules

Do not:

- Hardcode credentials.
- Expose secret keys.
- Disable authentication or permissions for convenience.
- Trust user input without validation.
- Allow users to access submissions or reviews they are not authorized to see.
- Reveal reviewer identities in double-blind workflows.
- Expose confidential editor comments to authors.
- Store sensitive files in public locations.
- Commit `.env` files.

Always consider authorization when implementing APIs.

Security is especially important for:

- Manuscript files
- Review reports
- Reviewer identities
- Editorial decisions
- User accounts
- Admin functionality
- AI analysis results

## File and Storage Rules

The system may use MinIO or another object storage service for manuscript files and published PDFs.

When implementing file handling:

1. Validate uploaded files.
2. Store files in organized paths.
3. Avoid exposing private manuscript files publicly.
4. Keep published files separate from private submission files.
5. Preserve previous submission version files.
6. Consider file size limits.
7. Consider allowed file types.
8. Do not trust file names provided by users.

## API Design Rules

For REST APIs:

1. Use consistent endpoint naming.
2. Use appropriate HTTP methods.
3. Return meaningful status codes.
4. Use serializers for validation.
5. Use pagination for list endpoints where needed.
6. Use filtering and search carefully.
7. Protect endpoints with permissions.
8. Document APIs using drf-spectacular.
9. Avoid leaking private workflow information.
10. Keep response formats consistent.

## Error Handling Rules

Errors should be clear, useful, and safe.

Do not expose:

- Stack traces
- Secret values
- Internal implementation details
- Sensitive workflow information

Validation errors should help users understand what must be corrected.

## Environment and Configuration Rules

Use environment variables for environment-specific settings.

Examples:

- Database credentials
- Secret key
- Debug mode
- Allowed hosts
- Email settings
- MinIO credentials
- Redis URL
- AI model settings
- File storage settings

Provide safe examples in `.env.example`.

Do not commit real secrets.

## Git and Change Management Rules

When making changes:

1. Keep commits focused.
2. Use clear commit messages.
3. Avoid mixing refactoring with feature implementation unless necessary.
4. Explain why major changes were made.
5. Update documentation when behavior changes.
6. Do not remove existing functionality without explicit reason.

Suggested commit message style:

```text
type(scope): short description
```

Examples:

```text
feat(submissions): add submission version model
fix(reviews): prevent unassigned reviewers from submitting reports
docs(architecture): document modular monolith decision
test(accounts): add role permission tests
```

## Response Format for AI Coding Assistants

Before implementing a non-trivial task, provide:

1. A short understanding of the task.
2. A proposed implementation plan.
3. Files expected to be modified.
4. Design choices and tradeoffs.
5. Tests to add or update.

Wait for approval if the task is large, architectural, or ambiguous.

After implementation, summarize:

1. Files changed.
2. Main design decisions.
3. How to test the change.
4. Risks, limitations, or TODOs.

## What Not To Do

Do not:

- Build the entire system in one task.
- Mix unrelated features in one change.
- Add unnecessary dependencies.
- Create premature abstractions.
- Move to microservices without explicit approval.
- Implement AI features before the core workflow is stable.
- Ignore permissions.
- Ignore tests.
- Rewrite existing architecture without justification.
- Hardcode journal-specific values.
- Automatically make final editorial decisions using AI.
- Expose private review data.
- Treat reviewer recommendation as automatic reviewer assignment.

## Development Priority

The recommended implementation order is:

1. Project setup and documentation
2. User and role management
3. Journal sections and configuration
4. Submission creation and metadata
5. Submission versioning
6. Section editor assignment
7. Review assignment
8. Review reports
9. Editorial decisions
10. Copyediting
11. Publishing
12. Topic modeling
13. Reviewer recommendation
14. Plagiarism detection
15. Metadata extraction
16. Intelligent ranking and prioritization
17. Dashboards and analytics

Core workflow comes before advanced AI features.

## Current Development Principle

When unsure, choose the simpler, clearer, and more maintainable solution.

The project should demonstrate professional software engineering quality, not unnecessary complexity.
