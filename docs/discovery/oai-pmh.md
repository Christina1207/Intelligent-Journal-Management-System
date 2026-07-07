# OAI-PMH Provider

The OAI-PMH provider is available at `/oai` and `/oai/`.

Phase 3 supports only the `oai_dc` metadata format and exposes published
article metadata. Draft, retracted, and unpublished publication records are not
exposed.

## Supported Verbs

- `Identify`
- `ListMetadataFormats`
- `ListSets`
- `ListIdentifiers`
- `ListRecords`
- `GetRecord`

## Identifiers

Published article identifiers use this format:

```text
oai:{repository-identifier}:article:{article-slug}
```

The repository identifier is currently derived from
`JournalMetadataSettings.base_url`. Changing `base_url` can therefore change
OAI identifiers for existing records. A future production hardening step should
introduce an explicit stable repository identifier setting before public
harvesting depends on the endpoint.

## Sets

OAI sets are generated from active journal sections:

```text
section:{slugified-section-name}
```

This is acceptable for the MVP, but it is not fully stable because changing a
section name changes the generated `setSpec`. A future production hardening step
should use a persistent section slug or another stable section identifier.

## Datestamps

Datestamps use `YYYY-MM-DD` granularity. The source priority is:

1. `metadata_updated_at`
2. `published_at`
3. `updated_at`
4. `created_at`

## Current Limitations

- No `resumptionToken` pagination yet.
- Only `metadataPrefix=oai_dc` is supported.
- Deleted records are reported as unsupported with `deletedRecord=no`.
- Identifier stability depends on `JournalMetadataSettings.base_url`.
- Set stability depends on section names.
