# Arabic Plagiarism Screening

## Purpose

The plagiarism integration provides initial academic-integrity
screening for Arabic manuscripts.

It is a decision-support feature. It identifies potential textual
overlap for human review but never accepts, rejects, or changes the
workflow status of a submission automatically.

## Supported scope

The current implementation supports:

- Arabic submissions.
- Text-based PDF manuscripts with usable embedded text.
- Automatic screening of the initial submission version.
- Manual retry by the responsible Section Manager.
- Lexical and semantic candidate retrieval.
- Local AraT5-based pair verification.
- Versioned `plagiarism_report_v1` reports.
- Passage-level evidence and source-document summaries.
- Historical screening records.
- Manager-only access to complete evidence.

## Future Scope:

- OCR for scanned PDFs.
- Screening for non-Arabic submissions.

## Runtime flow

1. An author submits an Arabic manuscript.
2. Submission creation completes normally.
3. After the database transaction commits, a screening record is
   created and sent to the dedicated `plagiarism` Celery queue.
4. The dedicated worker downloads the full manuscript from private
   MinIO storage to a temporary local path.
5. The worker loads and caches the local E5 and AraT5 resources.
6. The manuscript is compared with the configured PostgreSQL source
   corpus and semantic cache.
7. A `plagiarism_report_v1` report is stored with the screening.
8. The responsible Section Manager can inspect the summary and complete
   passage-level evidence through the triage workspace.

Failure of plagiarism screening does not roll back submission creation
or block the ordinary editorial workflow.

## Required external resources

The following resources are deployment-specific and must not be
committed to Git:

```text
pipeline_resources/
├── models/
│   ├── multilingual-e5-base/
│   ├── AraT5v2-base-1024/
│   └── verifier/
│       └── f2_x2_o1_c1/
│           └── best_model.pt
└── cache/
    └── semantic/
        ├── <source_type>_embeddings.npy
        ├── <source_type>_metadata.json
        └── <source_type>_manifest.json
```

`<source_type>` must exactly match:

- `PLAGIARISM_SOURCE_TYPE`
- The source type stored in the plagiarism source database
- The semantic-cache filename prefix

The writable BM25 cache is stored in the  
`plagiarism_cache` Docker volume.

## Configuration

Copy `.env.example` to `.env`, provide the ordinary application  
settings, and configure the plagiarism variables.

Keep `PLAGIARISM_ENABLED=False` when resources are not installed.  
Set it to `True` only after the models, checkpoint, semantic cache, and  
source corpus are available.

The dedicated worker is defined in `docker-compose.yml` with:

- Queue: `plagiarism`
- Concurrency: `1`
- Prefetch multiplier: `1`
- Read-only resource mount
- Separate writable cache volume

This isolates the memory-intensive pipeline from ordinary Celery tasks.
