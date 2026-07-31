from plagiarism_core.pipeline.candidate_adapter import (
    ProductionCandidateAdapter,
)
from plagiarism_core.pipeline.factory import (
    DefaultLocalPipelineConfig,
    build_default_local_pipeline,
)
from plagiarism_core.pipeline.interfaces import (
    DocumentPreprocessor,
    SegmentCandidateRetriever,
)
from plagiarism_core.pipeline.orchestrator import (
    InMemoryPlagiarismPipeline,
    PlagiarismCheckResult,
)
from plagiarism_core.pipeline.retrieval_adapter import (
    HybridCandidateRetriever,
)

__all__ = [
    "DefaultLocalPipelineConfig",
    "DocumentPreprocessor",
    "HybridCandidateRetriever",
    "InMemoryPlagiarismPipeline",
    "PlagiarismCheckResult",
    "ProductionCandidateAdapter",
    "SegmentCandidateRetriever",
    "build_default_local_pipeline",
]
