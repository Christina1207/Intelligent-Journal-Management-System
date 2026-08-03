import os
import time

import numpy as np
from dotenv import load_dotenv
from huggingface_hub import InferenceClient


class HuggingFaceE5APIEmbedder:
    """
    Online multilingual-e5-base embedder using Hugging Face Inference API.

    This class does not download or load the model locally.

    It sends text to Hugging Face and receives embedding vectors.

    E5 prefix rules:
        source segments:
            "passage: <text>"

        submitted/query segments:
            "query: <text>"
    """

    def __init__(
        self,
        model_id: str | None = None,
        provider: str | None = None,
        batch_size: int | None = None,
        max_retries: int = 3,
        retry_sleep_seconds: float = 3.0,
    ) -> None:
        load_dotenv()

        self.model_id = model_id or os.getenv(
            "HF_EMBEDDING_MODEL_ID",
            "embaas/sentence-transformers-multilingual-e5-base",
        )

        self.provider = provider or os.getenv(
            "HF_EMBEDDING_PROVIDER",
            "hf-inference",
        )

        self.batch_size = batch_size or int(
            os.getenv("HF_EMBEDDING_BATCH_SIZE", "1")
        )

        self.max_retries = max_retries
        self.retry_sleep_seconds = retry_sleep_seconds
        self.model_name = self.model_id
        self.embedding_dimension = 768

        api_token = os.getenv("HF_TOKEN")

        if not api_token:
            raise ValueError(
                "HF_TOKEN is missing. Add it to your .env file."
            )

        self.client = InferenceClient(
            provider=self.provider,
            api_key=api_token,
        )

    def embed_passages(
        self,
        texts: list[str],
        show_progress_bar: bool = False,
    ) -> list[list[float]]:
        """
        Embed source segments.

        Used offline when indexing source documents.
        """
        prefixed_texts = [
            self._format_passage(text)
            for text in texts
        ]

        return self._encode_batched(prefixed_texts)

    def embed_queries(
        self,
        texts: list[str],
        show_progress_bar: bool = False,
    ) -> list[list[float]]:
        """
        Embed submitted/query segments.

        Used online during semantic retrieval.
        """
        prefixed_texts = [
            self._format_query(text)
            for text in texts
        ]

        return self._encode_batched(prefixed_texts)

    def embed_query(
        self,
        text: str,
    ) -> list[float]:
        """
        Embed one submitted/query segment.
        """
        return self.embed_queries([text])[0]

    def _encode_batched(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        if not texts:
            return []

        all_embeddings: list[list[float]] = []

        for start in range(0, len(texts), self.batch_size):
            batch = texts[start : start + self.batch_size]
            batch_embeddings = self._call_api_with_retries(batch)
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    def _call_api_with_retries(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Call Hugging Face API with simple retries.

        Some hosted models may have cold starts or temporary failures.
        """
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                result = self.client.feature_extraction(
                    text=texts,
                    model=self.model_id,
                )

                return self._normalize_api_result(result)

            except Exception as error:
                last_error = error

                if attempt == self.max_retries:
                    break

                time.sleep(self.retry_sleep_seconds)

        raise RuntimeError(
            f"Failed to call Hugging Face embedding API after "
            f"{self.max_retries} attempts."
        ) from last_error

    def _normalize_api_result(
        self,
        result,
    ) -> list[list[float]]:
        """
        Convert API result into list[list[float]].

        Expected final shape:
            number_of_texts × 768
        """
        array = np.asarray(result, dtype=np.float32)

        if array.ndim == 1:
            array = array.reshape(1, -1)

        if array.ndim != 2:
            raise ValueError(
                f"Unexpected embedding shape from API: {array.shape}. "
                "Expected a 2D array: batch_size × embedding_dimension."
            )

        if array.shape[1] != self.embedding_dimension:
            raise ValueError(
                f"Unexpected embedding dimension: {array.shape[1]}. "
                f"Expected {self.embedding_dimension} for multilingual-e5-base."
            )

        array = self._l2_normalize(array)

        return array.astype(float).tolist()

    def _l2_normalize(
        self,
        array: np.ndarray,
    ) -> np.ndarray:
        norms = np.linalg.norm(array, axis=1, keepdims=True)

        norms[norms == 0] = 1.0

        return array / norms

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