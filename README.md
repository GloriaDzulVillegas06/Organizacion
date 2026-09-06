# Organización · Plataforma multi-equipo

Esta versión conserva **el diseño actual de Xolitas F.C. como plantilla maestra**. No es un rediseño: el layout público, tarjetas, jornadas, plantilla, goleadoras, clasificación, patrocinadores, modo partido, animaciones y responsive parten del proyecto `Xolitas-main(2)`.

Lo que cambia por equipo es la identidad y la información: nombre, logo, colores, textos, jugadoras, partidos, ligas, estadísticas, clasificación y patrocinadores.

## URLs

El repositorio está preparado para llamarse `Organizacion` en GitHub Pages.

- `/Organizacion/xolitas/`
- `/Organizacion/panteras/`
- `/Organizacion/cualquier-slug/`
- `/Organizacion/admin/login.html?team=xolitas`
- `/Organizacion/platform/index.html` (SUPER_ADMIN)

`404.html` actúa como resolvedor para las URLs limpias de equipos en GitHub Pages. No se crea una carpeta física por cliente.

## Lo incluido

### Página pública dinámica
- Diseño original de Xolitas.
- Identidad dinámica por `slug`.
- Colores CSS configurables sin cambiar layout.
- Textos de secciones configurables.
- Activación/desactivación de módulos públicos.
- Plantilla y fichas de jugadoras.
- Jornadas, último resultado y próximo partido.
- Tabla de clasificación.
- Goleadoras y filtro por liga.
- Patrocinadores.
- Realtime para partidos y eventos.

### Dashboard por equipo
- Dashboard deportivo con el diseño actual de Xolitas.
- Jugadoras: alta, edición, baja y fotografía.
- Ligas.
- Jornadas/partidos.
- Escudo rival.
- Resultados históricos y asignación de goleadoras.
- Clasificación.
- Patrocinadores.
- Modo partido: gol, gol rival, autogol, amarilla, segunda amarilla, roja, expulsión, pausa, finalizar y anular evento.
- Identidad del equipo: logo, colores, textos y módulos.
- Usuarios/roles.
- Consulta del plan y funciones.

### SUPER_ADMIN
- Organizaciones y equipos.
- Crear organización + primer equipo.
- Agregar equipos a una organización existente.
- URLs por slug.
- Suspender/reactivar organizaciones.
- Suscripciones.
- Planes y matriz de feature flags.

### Backend Supabase
- PostgreSQL multi-tenant.
- Supabase Auth.
- Storage `team-assets`.
- Realtime en `matches` y `match_events`.
- RLS por organización/equipo.
- Roles: `owner`, `admin`, `capturista`, `entrenador`, `viewer`.
- Rol de plataforma `super_admin`.
- Planes y feature flags.
- Trial automático Pro al crear organización desde SUPER_ADMIN.
- Límite de equipos por plan.
- Auditoría.
- Invitaciones de usuarios.
- Catálogo inicial de deportes/posiciones.
- Convocatoria/alineación (`match_rosters`) preparada para ampliarse.
- Campo de dominio personalizado preparado en configuración.

## Instalación

1. Crea un proyecto en Supabase.
2. En SQL Editor ejecuta `supabase/01_SCHEMA_COMPLETO.sql` completo.
3. En Authentication crea tu usuario con correo y contraseña.
4. Abre `supabase/02_CREAR_SUPER_ADMIN_Y_XOLITAS.sql`, cambia `TU_CORREO_AQUI` por ese correo y ejecútalo.
5. Opcionalmente ejecuta `supabase/03_DATOS_INICIALES_XOLITAS.sql` para cargar los datos base conocidos.
6. En Supabase copia Project URL y Publishable/Anon key.
7. Edita `assets/js/config.js`:

```js
SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
SUPABASE_PUBLISHABLE_KEY: 'TU_PUBLISHABLE_KEY',
DEMO_MODE: false,
```

8. Sube **el contenido de esta carpeta** a la raíz del repositorio GitHub `Organizacion`.
9. Activa GitHub Pages desde la rama principal y carpeta raíz.

No coloques `service_role` en GitHub.

## Modo sin Supabase

Si todavía no están configuradas las credenciales, `AUTO_DEMO_IF_UNCONFIGURED: true` activa almacenamiento local. Esto sirve para revisar diseño y navegación, pero el modo de producción es Supabase.

## Regla visual

Xolitas es la plantilla maestra. Para agregar un equipo nuevo **no se modifica el HTML/CSS estructural**. Se cambian datos y variables de identidad desde el dashboard.

## Archivos principales

- `index.html` y `404.html`: página pública/route resolver.
- `src.js`: renderer público conservando el diseño de Xolitas.
- `assets/js/runtime.js`: contexto multi-tenant, Supabase, servicios y compatibilidad con la UI original.
- `assets/js/admin.js`: dashboard operativo por equipo.
- `assets/js/match.js`: modo partido.
- `assets/js/platform.js`: SUPER_ADMIN.
- `supabase/01_SCHEMA_COMPLETO.sql`: esquema, RLS, RPC, Storage, Realtime, planes y seeds.

La carpeta `docs/legacy` contiene piezas antiguas únicamente como referencia y no se cargan en producción.
