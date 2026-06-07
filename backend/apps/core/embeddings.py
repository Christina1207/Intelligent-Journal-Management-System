from sentence_transformers import SentenceTransformer
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# Module-level singleton — model loads once per worker process
# Loading inside a function would reload on every call
_model = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL_NAME)
        _model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        logger.info("Embedding model loaded successfully")
    return _model


class EmbeddingService:
    """
    Abstraction over the embedding model.
    Business logic never imports SentenceTransformer directly —
    always goes through here. Swap the model in settings only.
    """

    @staticmethod
    def generate(text: str) -> list[float]:
        """
        Generate a normalized embedding vector for the given text.
        Returns a list of floats compatible with pgvector.
        """
        if not text or not text.strip():
            raise ValueError("Cannot generate embedding for empty text.")

        model = _get_model()
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    @staticmethod
    def generate_combined(texts: list[str]) -> list[float]:
        """
        Combine multiple text sources into a single embedding.
        Used for reviewer expertise: keywords + biography + publications.
        Concatenates texts, generates one unified embedding.
        """
        combined = " ".join(t for t in texts if t and t.strip())
        if not combined:
            raise ValueError("Cannot generate embedding from empty text list.")
        return EmbeddingService.generate(combined)