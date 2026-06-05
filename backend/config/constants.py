from decouple import config

# Journal Policy
REQUIRED_REVIEWS_COUNT = config('REQUIRED_REVIEWS_COUNT', default=2, cast=int)