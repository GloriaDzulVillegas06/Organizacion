# Sports Admin / Organizacion

Plataforma multi-equipo creada a partir del proyecto Xolitas F.C. para publicarse en GitHub Pages y usar Supabase como backend.

## Qué incluye

- Un solo repositorio y una sola base de código.
- URL pública por slug: `/Organizacion/xolitas/`, `/Organizacion/panteras/`, etc.
- Xolitas funciona como primer tenant y sigue siendo totalmente administrable.
- Super Admin: equipos, suscripciones, planes y feature flags.
- Administración por equipo: dashboard, identidad, jugadoras, ligas, partidos, clasificación, patrocinadores, usuarios, plan y modo partido.
- Página pública dinámica con branding, módulos configurables, plantilla, calendario, estadísticas, tabla, patrocinadores y marcador.
- Supabase Auth + PostgreSQL + Storage + Realtime + RLS.
- Roles: owner, admin, capturista, entrenador, viewer; rol de plataforma super_admin.
- Eventos de partido con anulación en vez de borrado histórico.
- Planes iniciales: Starter $249, Pro $449, Elite $699, Club $1,299 MXN/mes.
- Modo demo local para revisar el frontend antes de conectar Supabase.

## Orden de instalación

1. Crea un proyecto en Supabase.
2. En SQL Editor ejecuta `supabase/01_SCHEMA_COMPLETO.sql` completo.
3. En Authentication > Users crea tu usuario con correo y contraseña.
4. Abre `supabase/02_CREAR_SUPER_ADMIN_Y_XOLITAS.sql`, sustituye `TU_CORREO_AQUI` y ejecútalo.
5. Opcional: ejecuta `supabase/03_DATOS_INICIALES_XOLITAS.sql` para cargar los registros base conocidos del Sheet.
6. En Project Settings copia `Project URL` y la `Publishable key` (o anon key de proyecto legacy).
7. Edita `assets/js/config.js`:

```js
SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_...',
DEMO_MODE: false
```

8. NO uses ni publiques `service_role`.
9. Sube el contenido de esta carpeta al repositorio GitHub `Organizacion` y activa GitHub Pages desde la rama principal.
10. Entra a `/Organizacion/admin/login.html`.

## URLs

- Login: `/Organizacion/admin/login.html`
- Super Admin: `/Organizacion/admin/index.html`
- Xolitas: `/Organizacion/xolitas/`
- Cualquier nuevo equipo: `/Organizacion/{slug}/`

GitHub Pages servirá `404.html` para las rutas de equipos que no existen físicamente. Ese archivo usa el mismo frontend público y resuelve el `slug` desde la URL. No necesitas crear una carpeta por cliente.

## Seguridad

La interfaz oculta acciones según contexto, pero la seguridad real vive en Supabase RLS. Cada entidad deportiva guarda `team_id`; el equipo pertenece a `organization_id`; las políticas validan membresía y rol.

- OWNER/ADMIN: administración amplia de la organización.
- CAPTURISTA: partidos y eventos.
- ENTRENADOR: plantilla y partidos según política.
- VIEWER: lectura.
- SUPER_ADMIN: acceso global de plataforma.

## Invitaciones

Si invitas un correo que ya existe en Supabase Auth, se agrega la membresía inmediatamente. Si todavía no existe, se registra una invitación pendiente. Para una versión comercial posterior puede conectarse un proveedor de correo/Edge Function para enviar automáticamente el enlace de alta; la base ya contempla el estado de invitación.

## Realtime

`matches` y `match_events` se agregan a `supabase_realtime`. La página pública se suscribe a cambios del equipo y se vuelve a renderizar cuando se registra un evento o cambia el partido. Para mayor escala se puede migrar a Broadcast sin alterar el modelo de datos.

## Storage

Bucket público: `team-assets`.

Estructura usada por el frontend:

`teams/{team_id}/{branding|players|opponents|sponsors}/{archivo}`

Las escrituras están protegidas por RLS y requieren pertenecer a la organización dueña del equipo.

## Migración del proyecto Xolitas actual

No borres la página actual hasta validar la nueva versión. Primero:

1. Carga Xolitas en Supabase.
2. Migra jugadoras, ligas, partidos, eventos, clasificación y patrocinadores.
3. Compara conteos y marcadores.
4. Valida el modo partido.
5. Cambia la URL que compartes al nuevo `/Organizacion/xolitas/` cuando estés conforme.

La columna `legacy_id` se conserva para mapear IDs de Google Sheets durante la migración.

## Producción

Para venderlo a varios equipos conviene después mover el frontend de GitHub Pages a Cloudflare Pages/Netlify/Vercel para rutas reales, dominios personalizados y SEO, manteniendo Supabase sin cambios. GitHub Pages funciona bien para la primera etapa.
