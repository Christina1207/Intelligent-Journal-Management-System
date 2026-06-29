# Intelligent Journal Management System

An open-source electronic system for managing peer-reviewed scientific journals, enhanced with artificial intelligence and scientific text analysis to support decision-making in academic publishing.

## Project Objective

The objective of this project is to develop an open-source electronic system for managing peer-reviewed scientific journals.

The system focuses on building a reusable and customizable platform that supports the full scientific publishing life cycle:

**Submission → Review → Evaluation → Publishing**

The project integrates AI techniques and scientific text analysis to improve editorial workflows, support scientific integrity, and help editors make better data-driven decisions.

The system is designed so that different academic institutions and university journals can adopt it without needing to redevelop the platform from scratch.

## Main Goals

The project aims to:

- Provide a digital platform for managing scientific journal workflows.
- Support authors, reviewers, editors, editors-in-chief, copyeditors, and administrators.
- Enable electronic paper submission and metadata entry.
- Support peer review, editorial decisions, revision rounds, and publishing.
- Improve scientific integrity through initial plagiarism detection.
- Recommend suitable reviewers based on paper topics and reviewer expertise.
- Extract research topics from submitted papers using NLP and topic modeling.
- Help editorial boards prioritize paper processing using transparent ranking criteria.
- Provide analytical dashboards for publishing trends and research indicators.
- Support customization for different journals, institutions, and editorial policies.
- Demonstrate strong software engineering practices in a real academic publishing system.

## Scope

The system supports the entire scientific publishing life cycle, including:

1. User and role management
2. Electronic submission
3. Manuscript upload
4. Metadata entry
5. Section assignment
6. Peer review
7. Double-blind review support
8. Multiple review rounds
9. Submission versioning
10. Editorial decision management
11. Copyediting
12. Electronic publishing
13. Issue archiving
14. Plagiarism screening
15. Reviewer recommendation
16. Topic modeling
17. Metadata extraction
18. Intelligent paper ranking / prioritization
19. Analytical dashboards
20. Journal customization

Advanced AI features are intended to support editorial decision-making, not replace human judgment.

## Core Workflow

The expected workflow is:

1. An author creates an account.
2. The author submits a manuscript with metadata and files.
3. The submission is assigned to a journal section.
4. A section manager or editor assigns a section editor.
5. The section editor manages the review process.
6. Reviewers are invited.
7. Reviewers accept or decline review invitations.
8. Reviewers submit review reports.
9. The editor evaluates the reports.
10. The editor makes a decision.
11. The author may upload a revised version.
12. Multiple review rounds may occur.
13. The submission is accepted, rejected, or returned for modification.
14. Accepted submissions move to copyediting.
15. Final articles are published and archived in issues.

## Main System Features

### 1. User and Role Management

The system supports multiple user roles involved in the publishing workflow, including:

- Author / Researcher
- Reviewer
- Section Editor
- Section Manager
- Editor-in-Chief
- Copyeditor
- System Administrator
- Reader

A user may have more than one role.

The system uses role-based access control to ensure that users can only access the actions and data relevant to their responsibilities.

### 2. Electronic Submission System

Authors can submit scientific papers electronically by entering required metadata and uploading manuscript files.

Submissions may include:

- Title
- Abstract
- Keywords
- Language
- Author information
- Co-author information
- Journal section
- Manuscript file
- Cover letter
- References
- Additional metadata

### 3. Peer-Review System

The system supports scientific peer review, including:

- Reviewer assignment
- Reviewer invitations
- Review deadlines
- Review reports
- Double-blind review
- Confidential comments for editors
- Comments for authors
- Reviewer recommendations
- Review status tracking

### 4. Multiple Review Rounds and Submission Versioning

The system supports multiple review rounds.

When authors submit revised manuscripts, previous versions are preserved instead of overwritten. This allows editors and reviewers to track the evolution of a submission across the review process.

### 5. Publishing Decision Management

Editors can manage decisions such as:

- Accept
- Reject
- Minor revision
- Major revision
- Resubmission required
- Send to copyediting
- Publish

The system tracks decisions, decision letters, timestamps, and the responsible editorial user where appropriate.

### 6. Electronic Publishing

Accepted submissions can move to publishing, where they may be assigned to issues and made available as published articles.

Published articles may include:

- Title
- Abstract
- Authors
- DOI or identifier
- Publication date
- Issue
- PDF file
- Metadata for indexing
- View and download statistics

### 7. Plagiarism Detection

The system includes initial plagiarism detection to support academic integrity.

Plagiarism detection is treated as a screening tool. It helps editors identify potential issues but does not automatically make final decisions.

Future Arabic plagiarism detection support is an important target use case.

### 8. Reviewer Recommendation

The system recommends suitable reviewers by analyzing the submitted paper and comparing it with reviewer expertise.

Reviewer recommendation may consider:

- Paper title
- Paper abstract
- Extracted topics
- Reviewer research interests
- Reviewer expertise
- Reviewer workload
- Previous review history
- Availability
- Conflict of interest indicators, when available

The recommendation output is treated as a ranked list of suggestions, not as automatic reviewer assignment.

### 9. Topic Modeling

The system uses topic modeling to automatically extract research topics from submission titles and abstracts.

Topic modeling supports:

- Reviewer recommendation
- Submission clustering
- Editorial dashboards
- Research trend analysis
- Thematic grouping of published articles

### 10. Intelligent Paper Ranking / Prioritization

The system may include a transparent ranking or prioritization model to help the editorial board organize submission processing.

The first implementation should use a weighted heuristic rather than an opaque model.

Possible ranking factors include:

- Submission completeness
- Topic relevance
- Editorial priority
- Reviewer availability
- Deadline urgency
- Similarity to journal scope
- Section workload

This feature supports editorial workflow management but does not determine acceptance or rejection.

### 11. Metadata Extraction

The system may use machine learning or text processing techniques to extract metadata from submitted papers.

Possible extracted metadata includes:

- Title
- Abstract
- Keywords
- Author names
- Affiliations
- References
- Language
- Research topics

Extracted metadata should remain reviewable and editable by humans.

### 12. Analytical Dashboards

Dashboards provide insights for editors and administrators.

Possible indicators include:

- Number of submissions
- Submission status distribution
- Average review duration
- Reviewer workload
- Acceptance rate
- Rejection rate
- Active research topics
- Publishing trends
- Delayed reviews
- Published article counts
- Section-level statistics

### 13. Customization Support

The system is designed to be reusable by different academic institutions.

Configurable elements may include:

- Journal name
- Journal logo
- Visual identity
- Editorial policies
- Scientific sections or departments
- Roles and permissions
- Review deadlines
- Publishing settings
- Email templates
- Workflow settings

The project follows the principle of separating configuration from application logic.

## Mentor-Specified Technical Concepts

This project integrates several technical concepts from Software Engineering, Artificial Intelligence, and Scientific Publishing.

### 1. Software Engineering

The project applies the following software engineering concepts:

- Functional and non-functional requirements analysis
- Study and evaluation of existing open-source journal management systems, such as Open Journal Systems (OJS)
- Component-based software engineering
- Quality assurance and testing
- System documentation and user manuals
- Engineering of reusable systems
- Separation of configuration from application logic, also known as Configuration vs. Code
- Design of customizable systems

These concepts are reflected in the architecture through modular design, reusable components, configurable settings, role-based permissions, testing, and documentation.

### 2. Artificial Intelligence

The project integrates AI and scientific text analysis techniques, including:

- Plagiarism detection
- Natural Language Processing (NLP) for analyzing research titles and abstracts
- Topic modeling for automated research topic extraction
- Reviewer recommendation systems
- Semantic matching between research papers and reviewer expertise
- Intelligent paper ranking and prioritization
- Metadata extraction using Machine Learning (ML)

AI features are designed as decision-support tools. They assist editors and reviewers but do not replace human editorial judgment.

### 3. Supporting Concepts

The project also addresses supporting concepts related to scientific publishing and digital platforms, including:

- Scientific publishing workflows
- Research ethics
- Digital content management
- User Experience (UX) for editors and researchers

These concepts influence workflow design, review management, access control, publication management, and interface requirements.

## Technology Stack

### Backend

- Django
- Django REST Framework
- PostgreSQL
- pgvector
- Celery
- Redis
- MinIO
- drf-spectacular
- Simple JWT

### Frontend

- Next.js
- React

### AI and NLP

- Python-based NLP modules
- Sentence embeddings
- Topic modeling
- Semantic similarity
- Plagiarism detection components
- Metadata extraction components

### Development and Deployment

- Docker
- Docker Compose
- Git
- GitHub
- Environment-based configuration

## Architecture Overview

The project follows a **modular monolith** architecture.

This means the system is deployed as one main application while keeping the internal codebase organized into clear domain-based modules.

This architecture is suitable for the project because it provides:

- Simpler deployment
- Easier debugging
- Clear separation of responsibilities
- Lower operational complexity than microservices
- Good maintainability for an academic graduation project
- A path for future extraction of AI services if needed

Suggested backend modules include:

- `accounts`: users, roles, permissions, authentication
- `journals`: journal configuration, sections, issues, publishing settings
- `submissions`: submissions, submission versions, co-authors, manuscript files
- `reviews`: reviewer invitations, review assignments, review reports
- `workflow`: editorial workflow orchestration and state transitions
- `publishing`: published articles, issue assignment, public metadata
- `ai_services`: plagiarism detection, reviewer recommendation, topic modeling, metadata extraction, analytics support

## Development Philosophy

The project follows these principles:

- Build the core editorial workflow before advanced AI features.
- Keep the system modular and maintainable.
- Prefer clear code over clever code.
- Keep business logic separated from API and UI layers.
- Use services for complex workflow operations.
- Preserve submission, review, and decision history.
- Support configurability instead of hardcoding journal-specific values.
- Treat AI as a decision-support layer.
- Prioritize security, permissions, testing, and documentation.
- Design the system so it can be extended after the graduation project.

## Repository Structure

The expected repository structure is:

```text
intelligent-journal-management-system/
│
├── backend/
│   ├── accounts/
│   ├── journals/
│   ├── submissions/
│   ├── reviews/
│   ├── workflow/
│   ├── publishing/
│   ├── ai_services/
│   └── config/
│
├── frontend/
│   └── ...
│
├── docs/
│   ├── workflow.md
│   ├── api-guidelines.md
│   ├── user-roles.md
│   └── ai/
│       ├── plagiarism-detection.md
│       ├── reviewer-recommendation.md
│       └── topic-modeling.md
│
├── AGENTS.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── DECISIONS.md
├── CONTRIBUTING.md
├── README.md
├── .env.example
├── .gitignore
└── docker-compose.yml
```

The actual structure may evolve as the implementation progresses.

## Suggested Development Roadmap

### Phase 1: Project Setup and Documentation

- Repository setup
- Docker environment
- Backend and frontend setup
- README
- AGENTS.md
- Architecture documentation
- Environment configuration

### Phase 2: User and Role Management

- User model
- Authentication
- Roles
- Permissions
- Basic user profile
- Admin configuration

### Phase 3: Journal Configuration

- Journal settings
- Sections or departments
- Editorial policies
- Issue structure
- Customization foundations

### Phase 4: Submission Management

- Submission model
- Metadata entry
- Manuscript upload
- Co-authors
- Submission status
- Submission versioning

### Phase 5: Editorial Workflow

- Section editor assignment
- Workflow state transitions
- Editorial task tracking
- Decision history

### Phase 6: Review Workflow

- Reviewer invitations
- Review assignments
- Review reports
- Review deadlines
- Double-blind review support
- Multiple review rounds

### Phase 7: Copyediting and Publishing

- Copyediting workflow
- Accepted article preparation
- Issue assignment
- Published article archive
- Public article metadata

### Phase 8: Topic Modeling

- Title and abstract preprocessing
- Topic extraction
- Topic storage
- Dashboard and recommendation support

### Phase 9: Reviewer Recommendation

- Reviewer expertise profiles
- Semantic matching
- Ranked reviewer suggestions
- Workload-aware recommendation

### Phase 10: Plagiarism Detection

- Initial plagiarism screening
- Similarity scoring
- Result storage
- Editor review interface
- Arabic NLP considerations

### Phase 11: Metadata Extraction

- Metadata extraction from manuscript files
- Human review and correction
- Integration with submission form

### Phase 12: Intelligent Ranking and Dashboards

- Weighted prioritization model
- Editorial dashboards
- Publishing trend analysis
- Research indicators

## AI Design Principles

AI features should follow these rules:

- AI supports human decision-making.
- AI does not automatically accept or reject papers.
- AI outputs should be explainable where possible.
- AI results should be stored as recommendations, scores, or extracted metadata.
- Editors should be able to review and override AI suggestions.
- AI modules should be loosely coupled from the core workflow.
- Expensive AI tasks should be suitable for asynchronous processing.

## Security and Ethics

The system must respect scientific publishing ethics and protect sensitive editorial information.

Important security and ethical considerations include:

- Protecting manuscript files
- Protecting reviewer identities in double-blind review
- Protecting confidential editor comments
- Preventing unauthorized access to submissions and reviews
- Treating plagiarism results as indicators, not final judgments
- Avoiding fully automated editorial decisions
- Maintaining auditability of important actions
- Preserving review and decision history

## Configuration vs. Code

The system should avoid hardcoding journal-specific values.

Values that should be configurable include:

- Journal name
- Journal logo
- Visual identity
- Sections
- Roles and permissions
- Review deadlines
- Editorial policies
- Email templates
- Publishing settings
- Workflow behavior where practical

This supports reuse across different journals and institutions.

## Quality Assurance

The project should include testing and quality assurance practices.

Backend tests should cover:

- Model behavior
- Serializer validation
- API permissions
- Workflow transitions
- Role-based access control
- Submission versioning
- Review assignment rules
- Double-blind review restrictions
- Important service functions

Suggested backend commands:

```bash
python manage.py test
```

```bash
python manage.py makemigrations --check --dry-run
```

Frontend verification should cover:

- Form validation
- Role-based visibility
- API integration
- Loading states
- Error states
- Usability for authors, reviewers, editors, and administrators

## API Documentation

The backend API should be documented using drf-spectacular.

The project should provide:

- OpenAPI schema
- Swagger UI or similar interactive documentation
- Clear endpoint naming
- Consistent response formats
- Permission-aware API behavior

## Current Status

This project is under active development as a graduation project.

The first implementation priority is the core editorial workflow:

1. User and role management
2. Journal sections
3. Submission creation
4. Submission versioning
5. Section editor assignment
6. Review workflow
7. Editorial decisions
8. Publishing workflow

Advanced AI features will be added incrementally after the core workflow is stable.

## License

This project is intended to be open-source.

A specific license should be selected before public release.

Possible options include:

- MIT License
- Apache License 2.0
- GNU GPLv3

## Notes

This system is designed as both:

1. A functional journal management platform.
2. A software engineering graduation project demonstrating reusable system design, configurable architecture, quality assurance, documentation, and AI integration.

The implementation should prioritize correctness, maintainability, and extensibility over unnecessary complexity.
