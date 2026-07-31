from typing import Iterable

from psycopg.types.json import Jsonb

from plagiarism_core.schemas import SourceDocumentRecord, SourceSegmentRecord
from plagiarism_core.storage.postgres_connection import get_postgres_connection
from plagiarism_core.storage.postgres_schema import initialize_postgres_schema


class PostgresSourceRepository:
    """
    Persistence layer for source documents and source segments.

    This class hides PostgreSQL/Supabase details from the indexing pipeline.
    Later, a Django repository can replace this class.
    """

    def initialize(self) -> None:
        with get_postgres_connection() as connection:
            initialize_postgres_schema(connection)

    def get_document_by_text_hash(
        self,
        text_hash: str,
        source_type: str
    ) -> SourceDocumentRecord | None:
        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM source_documents
                    WHERE text_hash = %s
                        AND source_type = %s
                    """,
                    (text_hash, source_type),
                )

                row = cursor.fetchone()

        if row is None:
            return None

        return self._row_to_source_document(row)

    def count_segments_for_document(self, document_id: int) -> int:
        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT COUNT(*) AS count
                    FROM source_segments
                    WHERE source_document_id = %s
                    """,
                    (document_id,),
                )

                row = cursor.fetchone()

        return int(row["count"])

    def save_source_document_with_segments(
        self,
        document: SourceDocumentRecord,
        segments: Iterable[SourceSegmentRecord],
        replace_existing: bool = False,
    ) -> int:
        """
        Save a source document and its segments.

        If same text_hash exists:
        - replace_existing=False: keep old record
        - replace_existing=True: refresh metadata and segments
        """
        segment_list = list(segments)

        with get_postgres_connection() as connection:
            initialize_postgres_schema(connection)

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM source_documents
                    WHERE text_hash = %s
                        AND source_type = %s
                    """,
                    (document.text_hash, document.source_type),
                )

                existing_row = cursor.fetchone()

                if existing_row is not None:
                    document_id = int(existing_row["id"])

                    if not replace_existing:
                        connection.commit()
                        return document_id

                    cursor.execute(
                        """
                        DELETE FROM source_segments
                        WHERE source_document_id = %s
                        """,
                        (document_id,),
                    )

                    cursor.execute(
                        """
                        UPDATE source_documents
                        SET
                            external_id = %s,
                            title = %s,
                            language = %s,
                            source_type = %s,
                            file_path = %s,
                            file_hash = %s,
                            char_count = %s,
                            metadata_json = %s,
                            indexed_at = NOW()
                        WHERE id = %s
                        """,
                        (
                            document.external_id,
                            document.title,
                            document.language,
                            document.source_type,
                            document.file_path,
                            document.file_hash,
                            document.char_count,
                            Jsonb(document.metadata or {}),
                            document_id,
                        ),
                    )

                else:
                    cursor.execute(
                        """
                        INSERT INTO source_documents (
                            external_id,
                            title,
                            language,
                            source_type,
                            file_path,
                            file_hash,
                            text_hash,
                            char_count,
                            metadata_json
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            document.external_id,
                            document.title,
                            document.language,
                            document.source_type,
                            document.file_path,
                            document.file_hash,
                            document.text_hash,
                            document.char_count,
                            Jsonb(document.metadata or {}),
                        ),
                    )

                    inserted = cursor.fetchone()
                    document_id = int(inserted["id"])

                if segment_list:
                    cursor.executemany(
                        """
                        INSERT INTO source_segments (
                            source_document_id,
                            segment_index,
                            text,
                            normalized_text,
                            language,
                            start_offset,
                            end_offset,
                            token_count,
                            char_count
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                document_id,
                                segment.segment_index,
                                segment.text,
                                segment.normalized_text,
                                segment.language,
                                segment.start_offset,
                                segment.end_offset,
                                segment.token_count,
                                segment.char_count,
                            )
                            for segment in segment_list
                        ],
                    )

            connection.commit()

        return document_id

    def list_source_documents(self, limit: int = 20) -> list[SourceDocumentRecord]:
        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM source_documents
                    ORDER BY indexed_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )

                rows = cursor.fetchall()

        return [self._row_to_source_document(row) for row in rows]

    def list_segments_for_document(
        self,
        document_id: int,
    ) -> list[SourceSegmentRecord]:
        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM source_segments
                    WHERE source_document_id = %s
                    ORDER BY segment_index ASC
                    """,
                    (document_id,),
                )

                rows = cursor.fetchall()

        return [self._row_to_source_segment(row) for row in rows]

    def _row_to_source_document(self, row: dict) -> SourceDocumentRecord:
        return SourceDocumentRecord(
            id=int(row["id"]),
            external_id=row["external_id"],
            title=row["title"],
            language=row["language"],
            source_type=row["source_type"],
            file_path=row["file_path"],
            file_hash=row["file_hash"],
            text_hash=row["text_hash"],
            char_count=int(row["char_count"]),
            metadata=dict(row["metadata_json"] or {}),
            indexed_at=str(row["indexed_at"]),
        )

    def _row_to_source_segment(self, row: dict) -> SourceSegmentRecord:
        return SourceSegmentRecord(
            id=int(row["id"]),
            source_document_id=int(row["source_document_id"]),
            source_document_external_id=row.get(
                "source_document_external_id"
            ),
            segment_index=int(row["segment_index"]),
            text=row["text"],
            normalized_text=row["normalized_text"],
            language=row["language"],
            start_offset=int(row["start_offset"]),
            end_offset=int(row["end_offset"]),
            token_count=int(row["token_count"]),
            char_count=int(row["char_count"]),
        )
    
    def list_all_source_segments(
        self,
        language: str | None = None,
        limit: int | None = None,
        source_type: str | None = None,
        page_size: int = 1000,
    ) -> list[SourceSegmentRecord]:
        """
        Return source segments for building retrieval indexes.

        Important:
        - Does NOT load semantic_embedding.
        - Supports source_type filtering through source_documents.
        - Uses pagination to avoid Supabase statement timeouts.
        """
        all_segments: list[SourceSegmentRecord] = []
        last_seen_id = 0

        while True:
            query = """
                SELECT
                    ss.id,
                    ss.source_document_id,
                    ss.segment_index,
                    ss.text,
                    ss.normalized_text,
                    ss.language,
                    ss.start_offset,
                    ss.end_offset,
                    ss.token_count,
                    ss.char_count
                FROM source_segments ss
                JOIN source_documents sd
                    ON sd.id = ss.source_document_id
                WHERE ss.id > %s
            """

            params: list[object] = [last_seen_id]

            if language is not None and language != "mixed":
                query += " AND ss.language = %s"
                params.append(language)

            if source_type is not None:
                query += " AND sd.source_type = %s"
                params.append(source_type)

            current_page_size = page_size

            if limit is not None:
                remaining = limit - len(all_segments)

                if remaining <= 0:
                    break

                current_page_size = min(page_size, remaining)

            query += """
                ORDER BY ss.id ASC
                LIMIT %s
            """

            params.append(current_page_size)

            with get_postgres_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query, tuple(params))
                    rows = cursor.fetchall()

            if not rows:
                break

            page_segments = [
                self._row_to_source_segment(row)
                for row in rows
            ]

            all_segments.extend(page_segments)

            last_seen_id = max(
                segment.id
                for segment in page_segments
                if segment.id is not None
            )

            if limit is not None and len(all_segments) >= limit:
                break

        return all_segments

    def _embedding_to_pgvector_text(
    self,
    embedding: list[float],
    ) -> str:
        """
        Convert a Python list of floats to pgvector text format.

        Example:
        [0.1, 0.2, 0.3] -> '[0.1,0.2,0.3]'
        """
        return "[" + ",".join(f"{float(value):.8f}" for value in embedding) + "]"
        
    def list_source_segments_for_embedding(
        self,
        language: str | None = None,
        limit: int | None = None,
        only_missing: bool = True,
        source_type: str | None = None,
    ) -> list[SourceSegmentRecord]:
        query = """
            SELECT ss.*
            FROM source_segments ss
            JOIN source_documents sd
                ON sd.id = ss.source_document_id
        """

        conditions: list[str] = []
        params: list[object] = []

        if only_missing:
            conditions.append("ss.semantic_embedding IS NULL")

        if language is not None and language != "mixed":
            conditions.append("ss.language = %s")
            params.append(language)

        if source_type is not None:
            conditions.append("sd.source_type = %s")
            params.append(source_type)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY ss.id ASC"

        if limit is not None:
            query += " LIMIT %s"
            params.append(limit)

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(params))
                rows = cursor.fetchall()

        return [
            self._row_to_source_segment(row)
            for row in rows
        ]

    def update_source_segment_embeddings(
        self,
        embeddings_by_segment_id: dict[int, list[float]],
    ) -> int:
        """
        Store semantic embeddings for source segments.

        embeddings_by_segment_id:
            {
                source_segment_id: embedding_vector
            }
        """
        if not embeddings_by_segment_id:
            return 0

        params = []

        for segment_id, embedding in embeddings_by_segment_id.items():
            embedding_text = self._embedding_to_pgvector_text(embedding)
            params.append((embedding_text, segment_id))

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.executemany(
                    """
                    UPDATE source_segments
                    SET semantic_embedding = %s::vector
                    WHERE id = %s
                    """,
                    params,
                )

            connection.commit()

        return len(params)

    def search_source_segments_by_semantic_embedding(
        self,
        query_embedding: list[float],
        limit: int = 10,
        language: str | None = None,
        source_type: str | None = None,
    ) -> list[tuple[SourceSegmentRecord, float]]:
        """
        Retrieve source segments using pgvector cosine similarity.

        The query:
        - uses the HNSW index on semantic_embedding
        - optionally filters by source language
        - optionally filters by source document type
        - does not return the large embedding column
        """
        if not query_embedding:
            return []

        embedding_text = self._embedding_to_pgvector_text(query_embedding)

        query = """
            SELECT
                ss.id,
                ss.source_document_id,
                ss.segment_index,
                ss.text,
                ss.normalized_text,
                ss.language,
                ss.start_offset,
                ss.end_offset,
                ss.token_count,
                ss.char_count,
                1 - (
                    ss.semantic_embedding <=> %s::vector
                ) AS semantic_similarity
            FROM public.source_segments ss
            JOIN public.source_documents sd
                ON sd.id = ss.source_document_id
            WHERE ss.semantic_embedding IS NOT NULL
        """

        params: list[object] = [embedding_text]

        if language is not None and language != "mixed":
            query += " AND ss.language = %s"
            params.append(language)

        if source_type is not None:
            query += " AND sd.source_type = %s"
            params.append(source_type)

        query += """
            ORDER BY ss.semantic_embedding <=> %s::vector
            LIMIT %s
        """

        params.extend(
            [
                embedding_text,
                limit,
            ]
        )

        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:

                # Search more HNSW candidates to protect retrieval recall.
                cursor.execute(
                    "SET LOCAL hnsw.ef_search = 100"
                )

                # Add this only when pgvector is version 0.8.0 or newer.
                cursor.execute(
                    "SET LOCAL hnsw.iterative_scan = 'strict_order'"
                )

                cursor.execute(
                    query,
                    tuple(params),
                )

                rows = cursor.fetchall()

        results: list[tuple[SourceSegmentRecord, float]] = []

        for row in rows:
            source_segment = self._row_to_source_segment(row)

            similarity_score = float(
                row["semantic_similarity"] or 0.0
            )

            results.append(
                (
                    source_segment,
                    similarity_score,
                )
            )

        return results
    
    def get_source_document_by_id(
        self,
        document_id: int,
    ) -> SourceDocumentRecord | None:
        """
        Return one source document by internal database ID.
        """
        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM source_documents
                    WHERE id = %s
                    """,
                    (document_id,),
                )

                row = cursor.fetchone()

        if row is None:
            return None

        return self._row_to_source_document(row)
        
    def list_source_segments_with_embeddings(
        self,
        source_type: str | None = None,
        language: str | None = None,
        page_size: int = 200,
    ) -> list[tuple[SourceSegmentRecord, list[float]]]:
        """
        Export source-segment metadata and semantic embeddings.

        This method is intended for building the local semantic cache.
        It uses ID-based pagination and converts pgvector values to text
        before parsing them into Python floats.
        """
        results: list[
            tuple[SourceSegmentRecord, list[float]]
        ] = []

        last_seen_id = 0

        with get_postgres_connection() as connection:
            while True:
                query = """
                    SELECT
                        ss.id,
                        ss.source_document_id,
                        sd.external_id AS source_document_external_id,
                        ss.segment_index,
                        ss.text,
                        ss.normalized_text,
                        ss.language,
                        ss.start_offset,
                        ss.end_offset,
                        ss.token_count,
                        ss.char_count,
                        ss.semantic_embedding::text
                            AS semantic_embedding_text
                    FROM public.source_segments ss
                    JOIN public.source_documents sd
                        ON sd.id = ss.source_document_id
                    WHERE ss.id > %s
                    AND ss.semantic_embedding IS NOT NULL
                """

                params: list[object] = [last_seen_id]

                if source_type is not None:
                    query += " AND sd.source_type = %s"
                    params.append(source_type)

                if language is not None and language != "mixed":
                    query += " AND ss.language = %s"
                    params.append(language)

                query += """
                    ORDER BY ss.id ASC
                    LIMIT %s
                """

                params.append(page_size)

                with connection.cursor() as cursor:
                    cursor.execute(query, tuple(params))
                    rows = cursor.fetchall()

                if not rows:
                    break

                for row in rows:
                    segment = self._row_to_source_segment(row)

                    embedding = self._parse_pgvector_text(
                        row["semantic_embedding_text"]
                    )

                    results.append((segment, embedding))

                last_seen_id = rows[-1]["id"]

                print(
                    f"Exported {len(results)} source embeddings...",
                    flush=True,
                )

        return results


    @staticmethod
    def _parse_pgvector_text(
        value: str,
    ) -> list[float]:
        """
        Convert pgvector text such as:

            [0.123,-0.456,0.789]

        into a Python list of floats.
        """
        if value is None:
            raise ValueError(
                "The semantic embedding value is missing."
            )

        cleaned = value.strip()

        if (
            not cleaned.startswith("[")
            or not cleaned.endswith("]")
        ):
            raise ValueError(
                "Unexpected pgvector embedding format: "
                f"{cleaned[:100]}"
            )

        inner = cleaned[1:-1].strip()

        if not inner:
            return []

        return [
            float(component)
            for component in inner.split(",")
        ]