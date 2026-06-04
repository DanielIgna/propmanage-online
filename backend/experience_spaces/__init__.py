"""PropManage — Experience Spaces module.

Business Operating System layer that extends PropManage with bookable physical
spaces, service provider ecosystem, digital twins and AI business insights.

Module is completely isolated from existing PropManage workflows:
  - All MongoDB collections prefixed `es_`
  - All API routes under `/api/experience-spaces/*`
  - Feature-flagged via `app_settings.enable_experience_spaces`
  - Rollback: flip flag → all endpoints return 403 instantly
"""
