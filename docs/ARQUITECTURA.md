# Arquitectura

`organizations -> teams -> players / leagues / matches / match_events / sponsors / standings`

Usuarios de Supabase Auth se relacionan con organizaciones mediante `organization_members`. Un usuario puede tener roles distintos en organizaciones distintas.

La configuración visual se divide en:

- `team_branding`: colores, logo, portada y apariencia del dashboard.
- `team_site_settings`: etiquetas, módulos públicos y redes.

Las suscripciones se resuelven con:

- `plans`
- `features`
- `plan_features`
- `subscriptions`

El frontend debe consultar capacidades, no comparar nombres de plan.
