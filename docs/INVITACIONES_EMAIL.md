# Invitaciones reales por correo

Integracion incremental para GitHub Pages bajo `/Organizacion/`. No crea otra tabla de cuentas, no almacena contrasenas y no modifica datos deportivos, planes ni equipos. Las cuentas siguen en `auth.users`, las membresias en `organization_members`, las invitaciones en `invitations` y los permisos globales en `platform_users`.

## Antes de desplegar

Los adjuntos de la version anterior tenian nombres cruzados:

| Nombre recibido | Contenido real |
| --- | --- |
| `03_DATOS_INICIALES_XOLITAS.sql` | Esquema multi-tenant, RLS, RPC e invitaciones |
| `02_CREAR_SUPER_ADMIN_Y_XOLITAS.sql` | Datos deportivos iniciales |
| `04_INVITACIONES_EMAIL.sql` | Creacion del SUPER_ADMIN y tenant inicial |
| `index.ts` | SQL de aceptacion y activacion, no TypeScript |

No ejecutar esos archivos por su nombre ni volver a cargar el esquema completo sobre produccion. No se copiaron al proyecto. El nuevo `supabase/04_INVITACIONES_EMAIL.sql` de este repositorio SI es la migracion de invitaciones. Comparar el esquema instalado con el adjunto antes de aplicarla; no se inspecciono la base remota con privilegios administrativos.

## 1. SQL incremental

Respaldar la base y ejecutar en Supabase SQL Editor:

`supabase/04_INVITACIONES_EMAIL.sql`

Requiere las tablas y helpers del esquema original, incluido el indice unico parcial de invitaciones pendientes `(organization_id,lower(email)) WHERE status='pending'` y la clave unica de membresias `(organization_id,user_id)`. La migracion es transaccional y repetible: no elimina tablas ni datos. Si faltan contratos, corregir la version base; no crear tablas duplicadas.

Agrega solamente `requested_at`, `accepted_at`, `accepted_by`, funciones y restricciones del flujo:

- `invite_organization_member(uuid,text,text)`: conserva la firma y retorno UUID, pero ahora devuelve SIEMPRE el ID de una invitacion pendiente. Comprueba JWT, `has_org_role` y membresia activa real de owner/admin en ESA organizacion. Normaliza correo, valida rol y limita reintentos del mismo correo/organizacion a uno por minuto.
- `complete_member_invitation(uuid,uuid)`: solo ejecutable por `service_role`, usado exclusivamente por la Edge Function. Busca en Auth sin exponer IDs o perfiles al frontend. Una cuenta confirmada recibe UPSERT de membresia; una cuenta no confirmada no se activa.
- `get_my_invitation()`: consulta propia sin parametros para verificar vigencia antes de cambiar contrasena.
- `accept_my_invitation()`: sin parametros de correo, rol u organizacion. Usa `auth.uid()` y el correo del JWT, comprueba el usuario confirmado en Auth, bloquea filas, hace UPSERT y marca aceptacion. Acepta TODAS las invitaciones pendientes vigentes de ese correo con invitador aun autorizado. Devuelve `organization_id`, `role`, `memberships` y `team_slug`.
- El reintento tras aceptar solo reconoce invitaciones aceptadas por la misma cuenta, aun vigentes y con membresia activa. Tener acceso a otra organizacion no convierte un enlace invalido en valido.
- `list_organization_members` limita los correos visibles a administradores y distingue invitaciones vencidas.

Se revoca la escritura directa de `invitations` desde clientes y se agregan politicas restrictivas de respaldo. Las politicas restrictivas de membresias impiden que un admin se convierta en owner o modifique otro owner; se conservan las politicas permisivas existentes y la gestion global de plataforma. Solo owner puede invitar otro owner. El flujo de invitacion requiere membresia organizacional incluso si quien lo usa es SUPER_ADMIN.

Todas las nuevas funciones SECURITY DEFINER fijan `search_path=public`. Se revoca EXECUTE de PUBLIC/anon y del RPC legado `activate_existing_invited_member` para clientes, si existia. No se modifica `has_org_role`, porque el resto del sistema usa su acceso global de plataforma.

## 2. Variables de la Edge Function

Nunca guardar Secret Key, service role, contrasenas SMTP ni tokens CLI en HTML, JavaScript publico, Git o GitHub Pages. `.gitignore` excluye archivos `.env` y dependencias. No pegar secretos en chats ni capturas.

| Variable | Configuracion |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto, provisionada por Supabase |
| `APP_SUPABASE_PUBLISHABLE_KEY` | Publishable key del mismo proyecto, para cliente con JWT del invitador |
| `APP_SUPABASE_SECRET_KEY` | Secret key administrativa, SOLO dentro de Edge Functions |
| `PUBLIC_APP_URL` | `https://gloriadzulvillegas06.github.io/Organizacion` |

Supabase no permite crear secrets personalizados cuyo nombre empiece por `SUPABASE_`. Por eso los nombres propios usan el prefijo `APP_`. En Supabase hospedado la funcion usa como respaldo las variables provisionadas `SUPABASE_PUBLISHABLE_KEYS` y `SUPABASE_SECRET_KEYS`, tomando la clave `default`; no intentes sobrescribir esas variables reservadas.

En Dashboard > Edge Functions > Secrets configurar `PUBLIC_APP_URL`, `APP_SUPABASE_PUBLISHABLE_KEY` y `APP_SUPABASE_SECRET_KEY` si tu proyecto no expone correctamente las claves provisionadas. La funcion calcula la URL de aceptacion y CORS desde esa variable, sin dominio productivo hardcodeado. No poner una barra final, query ni fragmento. HTTPS es obligatorio salvo localhost.

## 3. Desplegar la funcion

La funcion usa `import { createClient } from 'npm:@supabase/supabase-js@2'` para resolver su dependencia incluso al desplegar desde el editor del Dashboard, sin importar archivos de configuracion locales. Si aparece `Relative import path "@supabase/supabase-js" not prefixed`, actualizar el import al especificador `npm:` antes de volver a desplegar. No instalar un paquete JSR ni desactivar la validacion JWT para corregir este error.

Si VS Code marca `Deno` o el import `npm:` como desconocidos, habilitar la extension Deno para la carpeta `supabase/functions`; el analizador TypeScript de Node no reconoce ese entorno. La comprobacion independiente es `npx deno check --no-config --node-modules-dir=none supabase/functions/invite-member/index.ts`.

Con Supabase CLI instalado y desde la raiz del proyecto:

```powershell
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set PUBLIC_APP_URL=https://gloriadzulvillegas06.github.io/Organizacion
supabase functions deploy invite-member
```

Para secretos adicionales permitidos en tu entorno, crear un archivo fuera del repositorio y cargarlo personalmente:

```powershell
supabase secrets set --env-file C:\ruta-privada\invite-member.env
```

No incluir las variables reservadas provisionadas por Supabase en ese archivo de produccion. Para servir localmente, usar `supabase functions serve invite-member --env-file C:\ruta-privada\invite-member.env` con URL, claves locales y `PUBLIC_APP_URL` del servidor local.

`supabase/config.toml` mantiene `verify_jwt = true`. Ademas, el handler valida explicitamente el token con `auth.getUser(jwt)` antes de cualquier RPC. El frontend usa `supabase.functions.invoke`, que envia automaticamente el JWT de su sesion. No desactivar autenticacion para resolver un 401: verificar sesion, proyecto y configuracion JWT primero.

Publicar los archivos frontend actualizados en GitHub Pages despues de aplicar SQL y desplegar la funcion. El proyecto sigue siendo estatico; no necesita bundler ni build. `package.json` contiene solo herramientas de pruebas y no cambia el despliegue.

## 4. URLs de Authentication

Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `https://gloriadzulvillegas06.github.io/Organizacion/`
- Redirect URL permitida: `https://gloriadzulvillegas06.github.io/Organizacion/aceptar-invitacion.html`

No quitar `/Organizacion/`. Para desarrollo agregar explicitamente la URL local de aceptacion, sin comodines amplios en produccion. La pagina procesa automaticamente el callback de Supabase JS v2, valida la sesion con Auth y limpia los parametros de autenticacion del historial. No usa metadata editable como fuente de permisos.

## 5. SMTP y plantillas

Supabase Dashboard > Authentication > Emails > SMTP Settings:

Configurar SMTP personalizado con Resend, SendGrid, Mailgun, AWS SES u otro proveedor compatible. Introducir host, puerto, usuario, password, remitente y nombre de remitente SOLO en Supabase. Verificar dominio/remitente y registros SPF/DKIM/DMARC segun el proveedor. Revisar limites de Auth y del proveedor: el envio predeterminado de Supabase puede estar restringido a destinatarios autorizados.

Authentication > Email Templates > Invite user:

Mantener `{{ .ConfirmationURL }}` como destino del enlace. No sustituirlo por la URL directa de la pagina: se perderia la verificacion de Auth. No agregar tokens propios. Evitar seguimiento de enlaces que altere el enlace firmado y considerar que escaneres de correo pueden consumir enlaces de un solo uso.

Una cuenta nueva recibe `auth.admin.inviteUserByEmail`. Una cuenta que existe pero aun no confirmo el correo recibe `signInWithOtp` con `shouldCreateUser:false`; configurar tambien Email Templates > Magic Link y conservar `{{ .ConfirmationURL }}`. Se usa este mecanismo para reenviar sin duplicar cuenta ni activarla prematuramente. Si Auth tiene CAPTCHA habilitado para OTP, este reenvio requerira adaptar la verificacion CAPTCHA antes de usarlo; no deshabilitar CAPTCHA globalmente como solucion silenciosa.

Un usuario EXISTENTE Y CONFIRMADO recibe directamente su membresia activa; no se cambia su contrasena ni se envia otra invitacion Auth. La respuesta es: "El usuario ya tenia cuenta y fue agregado al equipo."

Un fallo SMTP deja la invitacion pendiente y devuelve error. Reintentar pasado un minuto. No hay transaccion distribuida entre SQL y correo: si se corta la respuesta despues de enviar, comprobar bandeja y lista antes de reintentar. La vigencia SQL es de 7 dias; el enlace Auth puede vencer antes segun la configuracion del proyecto. Se requieren ambos vigentes.

## 6. Probar usuario nuevo

1. Entrar a `admin/login.html?team=xolitas` con una membresia activa owner/admin de Xolitas.
2. Usuarios y permisos > correo de prueba NUEVO > Capturista > Enviar invitacion.
3. Confirmar estado "Enviando...", un solo envio por clic y mensaje "Invitacion enviada por correo."
4. Verificar en SQL Editor una invitacion pendiente y ausencia de membresia activa para ese correo. Auth puede haber creado ya la cuenta invitada, pero eso no da permisos.
5. Abrir el correo en un navegador privado u otro dispositivo. Definir contrasena de al menos 8 caracteres y confirmarla.
6. Ver "Cuenta activada" y redireccion al dashboard del equipo autorizado. Comprobar `organization_members`: organizacion Xolitas, rol capturista, status active; `invitations`: accepted.
7. Cerrar sesion e iniciar con la nueva contrasena y URL del equipo. Intentar otro `?team=` no autorizado: debe bloquear el dashboard. Intentar invitar via HTTP como capturista: debe fallar en backend.

## 7. Probar usuario existente

1. Conservar el ID Auth y la contrasena de la cuenta confirmada anterior.
2. Entrar como owner/admin de una SEGUNDA organizacion, invitar el mismo correo y elegir entrenador.
3. Esperar "El usuario ya tenia cuenta y fue agregado al equipo." No se envia otro correo de alta.
4. Comprobar una sola cuenta Auth y dos membresias, cada una con su organizacion y rol. No debe cambiar la membresia de Xolitas.
5. Repetir en la misma organizacion pasado un minuto con otro rol permitido: actualiza la membresia sin duplicarla.
6. Entrar mediante la URL del equipo de esa organizacion; una tercera organizacion no debe ser accesible.

## 8. Casos de seguridad y fallos

- Sin JWT o con JWT vencido: 401, sin llamada privilegiada.
- Owner/admin de A invitando a B: rechazo SQL, aunque se altere el body HTTP.
- Viewer/capturista/entrenador, rol SUPER_ADMIN, rol nulo, email o UUID invalidos: rechazo.
- Admin invitando owner o degradando un owner: rechazo; probar tambien UPDATE directo bajo RLS.
- Invitado cambiando email/rol en la consola: la aceptacion no recibe esos parametros y usa datos guardados.
- Enlace vencido, cancelado o de otro correo: formulario bloqueado. Un error explicito del callback prevalece sobre una sesion previa.
- Invitador deshabilitado antes de aceptar: invitacion no aceptable. Una organizacion suspendida tampoco.
- Fallo SMTP/reintento y doble clic: no se anuncia un envio exitoso si Auth falla, ni se crean membresias duplicadas.
- Varias invitaciones pendientes del mismo correo: se aceptan todas las vigentes, con sus roles almacenados; se abre el primer equipo activo de la primera organizacion devuelta.

## 9. Validaciones locales

Requiere Node/npm; Deno se obtiene con npx para las pruebas Edge:

```powershell
npm ci
npm run check
npm test
npm run test:edge
```

Las pruebas SQL usan PostgreSQL embebido PGlite con un fixture de los contratos relevantes del esquema adjunto. Ejecutan la migracion dos veces y prueban RLS, permisos RPC, usuarios nuevos/existentes, roles, expiracion y aislamiento multi-tenant. No sustituyen la comprobacion de politicas/triggers adicionales en tu base real.

Las pruebas Edge usan supabase-js v2 con respuestas HTTP simuladas, sin permiso de red: no envian correos ni usan secretos reales. Las pruebas frontend verifican el rol por organizacion y el servicio de invitacion. La pagina se reviso en navegador en escritorio y movil, con Auth simulado, coincidencia/minimo de contrasena y enlace invalido. El envio SMTP y el callback real entre dispositivos deben probarse despues del despliegue.

## Hallazgos de la arquitectura anterior

- El frontend tomaba el primer rol de cualquier organizacion cuando no habia membresia en el equipo actual y asumia viewer por defecto. Corregido: solo rol de la organizacion actual, o acceso global explicito de plataforma.
- El login no hidrataba los permisos almacenados despues de autenticar. Corregido; logout tambien los limpia.
- Usuarios renderizaba asincronamente, pero se enlazaban controles del shell antes de terminar. Corregido esperando el render.
- El RPC antiguo confundia ID de cuenta con ID de invitacion y activaba cuentas no confirmadas. Se conserva la firma, cambiando ese contrato de retorno a ID de invitacion pendiente; no hay otros consumidores en este repositorio.
- `has_org_role` incluye bypass de SUPER_ADMIN. Se conserva para el resto del producto y se exige membresia organizacional adicional en invitaciones.
- Las politicas originales permitian escritura directa de invitaciones y que admin otorgara owner. El nuevo flujo agrega restricciones y revoca los accesos alternos conocidos.
- El SQL de aceptacion recibido tomaba solo la ultima invitacion y consideraba exitosa cualquier membresia existente, incluso de otra organizacion. Corregido con aceptacion propia e idempotencia vinculada a la invitacion.
- No hay una auditoria completa de todas las funciones SECURITY DEFINER de produccion. Cualquier RPC personalizado no versionado que cambie membresias debe revisarse antes del lanzamiento. No se modificaron operaciones deportivas ajenas a este flujo.