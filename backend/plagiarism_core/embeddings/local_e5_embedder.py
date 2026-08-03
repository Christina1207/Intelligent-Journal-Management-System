import os
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer


class LocalE5Embedder:
    """
    Local multilingual-e5-base embedder.

    Loads the model from disk and produces normalized embeddings.

    E5 input format:
        source segments:    "passage: <text>"
        submitted queries:  "query: <text>"
    """

    def __init__(
        self,
        model_path: str | None = None,
        device: str | None = None,
        batch_size: int | None = None,
        max_seq_length: int = 512,
    ) -> None:
        load_dotenv()

        self.model_path = model_path or os.getenv(
            "E5_MODEL_PATH",
            "models/multilingual-e5-base",
        )

        self.device = device or os.getenv("E5_DEVICE", "cpu")

        self.batch_size = batch_size or int(
            os.getenv("E5_BATCH_SIZE", "4")
        )

        self.max_seq_length = max_seq_length
        self.model_name = "intfloat/multilingual-e5-base"
        self.embedding_dimension = 768

        model_dir = Path(self.model_path)

        if not model_dir.exists():
            raise FileNotFoundError(
                f"Local E5 model folder was not found: {model_dir.resolve()}\n"
                "Run: python -m runners.download_e5_model"
            )

        self.model = SentenceTransformer(
            str(model_dir),
            device=self.device,
        )

        self.model.max_seq_length = self.max_seq_length

    def embed_passages(
        self,
        texts: list[str],
        show_progress_bar: bool = False,
    ) -> list[list[float]]:
        prefixed_texts = [
            self._format_passage(text)
            for text in texts
        ]

        return self._encode(
            prefixed_texts,
            show_progress_bar=show_progress_bar,
        )

    def embed_queries(
        self,
        texts: list[str],
        show_progress_bar: bool = False,
    ) -> list[list[float]]:
        prefixed_texts = [
            self._format_query(text)
            for text in texts
        ]

        return self._encode(
            prefixed_texts,
            show_progress_bar=show_progress_bar,
        )

    def embed_query(
        self,
        text: str,
    ) -> list[float]:
        return self.embed_queries([text])[0]

    def _encode(
        self,
        texts: list[str],
        show_progress_bar: bool = False,
    ) -> list[list[float]]:
        if not texts:
            return []

        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=show_progress_bar,
        )

        if isinstance(embeddings, np.ndarray):
            return embeddings.astype(float).tolist()

        return embeddings

    def _format_passage(
        self,
        text: str,
    ) -> str:
        return "passage: " + self._clean_text(text)

    def _format_query(
        self,
        text: str,
    ) -> str:
        return "query: " + self._clean_text(text)

    def _clean_text(
        self,
        text: str,
    ) -> str:
        return (text or "").strip()