# Checklist para publicar en GitHub Pages

## Supabase

- [ ] Crear proyecto Supabase.
- [ ] Ejecutar `01_SCHEMA_COMPLETO.sql` completo una vez.
- [ ] Crear tu usuario en Authentication > Users.
- [ ] Cambiar `TU_CORREO_AQUI` en `02_CREAR_SUPER_ADMIN_Y_XOLITAS.sql`.
- [ ] Ejecutar `02_CREAR_SUPER_ADMIN_Y_XOLITAS.sql`.
- [ ] Ejecutar opcionalmente `03_DATOS_INICIALES_XOLITAS.sql`.
- [ ] Copiar Project URL.
- [ ] Copiar Publishable/Anon key (nunca service_role).

## Código

En `assets/js/config.js`:

```js
BASE_PATH: '/Organizacion',
SUPABASE_URL: '...',
SUPABASE_PUBLISHABLE_KEY: '...',
DEMO_MODE: false,
```

Si el repositorio no se llama `Organizacion`, cambia `BASE_PATH` y las rutas absolutas `/Organizacion/` de `index.html`, `404.html` y `style.css`.

## GitHub

La raíz del repositorio debe verse así:

```text
/
├── index.html
├── 404.html
├── style.css
├── src.js
├── admin/
├── platform/
├── assets/
├── supabase/
└── docs/
```

No subir una carpeta adicional como `/Organizacion_SaaS_FINAL/index.html`; `index.html` debe estar directamente en la raíz del repo.

## Pruebas

- [ ] `/Organizacion/xolitas/` abre la página pública.
- [ ] El diseño se ve como la Xolitas actual.
- [ ] `/Organizacion/admin/login.html?team=xolitas` permite iniciar sesión.
- [ ] Dashboard muestra Xolitas.
- [ ] Crear/editar jugadora.
- [ ] Subir foto.
- [ ] Crear liga.
- [ ] Crear jornada.
- [ ] Abrir modo partido y registrar evento.
- [ ] Ver actualización pública tras evento.
- [ ] Editar Identidad y comprobar colores/textos.
- [ ] `/Organizacion/platform/index.html` abre SUPER_ADMIN.
- [ ] Crear otro equipo y comprobar `/Organizacion/slug-del-equipo/`.
- [ ] Iniciar sesión como otro usuario y verificar que RLS no muestre datos de otras organizaciones.
