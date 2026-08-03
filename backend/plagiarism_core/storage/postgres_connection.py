import os

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row


load_dotenv()


def get_database_url() -> str:
    """
    Return the plagiarism source-corpus database URL.

    PLAGIARISM_DATABASE_URL takes precedence so the source corpus
    remains separate from the journal application's database.
    DATABASE_URL is retained as a standalone-pipeline fallback.
    """
    database_url = (
        os.getenv("PLAGIARISM_DATABASE_URL")
        or os.getenv("DATABASE_URL")
    )

    if not database_url:
        raise RuntimeError(
            "PLAGIARISM_DATABASE_URL or DATABASE_URL is not set."
        )

    return database_url


def get_postgres_connection() -> psycopg.Connection:
    return psycopg.connect(
        get_database_url(),
        row_factory=dict_row,
        connect_timeout=15,
        options=(
            "-c statement_timeout=15000 "
            "-c lock_timeout=5000"
        ),
    )