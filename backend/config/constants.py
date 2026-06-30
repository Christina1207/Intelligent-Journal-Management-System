from decouple import config

# Journal Policy
REQUIRED_REVIEWS_COUNT = config('REQUIRED_REVIEWS_COUNT', default=2, cast=int)
MAX_REVISION_ROUNDS             = config('MAX_REVISION_ROUNDS', default=3, cast=int)

# Recommendations
REVIEWER_RECOMMENDATION_COUNT   = config('REVIEWER_RECOMMENDATION_COUNT', default=5, cast=int)

# Topic Modeling
MIN_SUBMISSIONS_FOR_CLUSTERING  = config('MIN_SUBMISSIONS_FOR_CLUSTERING', default=3, cast=int) #TODO: change later

# ORCID
ORCID_REFRESH_INTERVAL_DAYS     = config('ORCID_REFRESH_INTERVAL_DAYS', default=30, cast=int)

# Celery
CELERY_TASK_MAX_RETRIES         = config('CELERY_TASK_MAX_RETRIES', default=3, cast=int)