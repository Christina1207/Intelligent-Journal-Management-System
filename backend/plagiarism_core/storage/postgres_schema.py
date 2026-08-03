import psycopg


def initialize_postgres_schema(connection: psycopg.Connection) -> None:
    """
    Create MVP PostgreSQL tables.

    This schema is pgvector-ready, but we do not add embeddings yet.
    Embeddings will be added later after choosing the model dimension.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE EXTENSION IF NOT EXISTS vector;
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS source_documents (
                id BIGSERIAL PRIMARY KEY,

                external_id TEXT,
                title TEXT,
                language TEXT NOT NULL,
                source_type TEXT NOT NULL,

                file_path TEXT,
                file_hash TEXT,
                text_hash TEXT NOT NULL,

                char_count INTEGER NOT NULL,
                metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        cursor.execute(
            """
            ALTER TABLE source_documents
            DROP CONSTRAINT IF EXISTS source_documents_text_hash_key;
            """
        )

        cursor.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS
                uq_source_documents_source_type_text_hash
            ON source_documents(source_type, text_hash);
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
                idx_source_documents_source_type_external_id
            ON source_documents(source_type, external_id);
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_source_documents_external_id
            ON source_documents(external_id);
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_source_documents_source_type
            ON source_documents(source_type);
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_source_documents_language
            ON source_documents(language);
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS source_segments (
                id BIGSERIAL PRIMARY KEY,

                source_document_id BIGINT NOT NULL
                    REFERENCES source_documents(id)
                    ON DELETE CASCADE,

                segment_index INTEGER NOT NULL,

                text TEXT NOT NULL,
                normalized_text TEXT NOT NULL,
                language TEXT NOT NULL,

                start_offset INTEGER NOT NULL,
                end_offset INTEGER NOT NULL,

                token_count INTEGER NOT NULL,
                char_count INTEGER NOT NULL,

                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                CONSTRAINT uq_source_segment_per_document
                    UNIQUE(source_document_id, segment_index)
            );
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_source_segments_document_id
            ON source_segments(source_document_id);
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_source_segments_language
            ON source_segments(language);
            """
        )


    connection.commit()