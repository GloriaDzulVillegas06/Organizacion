# Panel de jugadoras y asistencia

## Activacion

1. Aplicar el esquema original e invitaciones `supabase/04_INVITACIONES_EMAIL.sql` si aun no estan instalados.
2. Respaldar la base y ejecutar `supabase/05_PANEL_JUGADORAS.sql` en Supabase SQL Editor. Es incremental, transaccional y repetible; conserva datos deportivos y roles.
3. Publicar los archivos frontend en GitHub Pages. No hay otra Edge Function ni secretos nuevos para este modulo.
4. Como owner/admin, invitar el correo de la jugadora con rol `viewer` desde Usuarios y permisos. Esperar a que active su cuenta. Una cuenta existente confirmada obtiene su membresia con el flujo de invitaciones actual.
5. En Convocatorias y asistencia > Cuentas de jugadoras, localizar la ficha, escribir ese mismo correo y pulsar Vincular. El backend exige cuenta confirmada y membresia activa de la misma organizacion. El entrenador no puede vincular cuentas.
6. La jugadora entra por el login del equipo. Una cuenta `viewer` vinculada se redirige desde el dashboard a Mi temporada. Quien tenga otro rol puede abrir Mi temporada desde el menu sin perder sus accesos existentes.

URLs de Xolitas:

- `https://gloriadzulvillegas06.github.io/Organizacion/admin/mi-temporada.html?team=xolitas`
- `https://gloriadzulvillegas06.github.io/Organizacion/admin/asistencia.html?team=xolitas`

No se crea un rol nuevo ni otra tabla de usuarios. `player_accounts` es exclusivamente una relacion entre una ficha deportiva existente y un ID de `auth.users`: una cuenta por ficha y una ficha por cuenta/equipo. Puede vincularse la misma cuenta a fichas de equipos distintos si tiene las membresias necesarias. No se vinculan automaticamente nombres o correos de las fichas deportivas. Desvincular no borra partidos, estadisticas, cuenta Auth ni membresia.

## Flujo del entrenador

En Convocatorias y asistencia:

- Filtrar por liga y/o fechas y seleccionar un partido.
- Antes del partido: elegir Convocada, Titular, Suplente o No convocada y Guardar en cada fila. No se marca asistencia de un partido aun programado.
- La jugadora responde Asistire, No podre asistir o Sin respuesta desde Mi temporada. Esa respuesta no valida asistencia.
- Al iniciar o finalizar el partido: registrar Presente, Falta justificada, Falta injustificada o Sin registrar. Marcar Jugo solo si participo y estuvo presente. Guardar cada fila.
- El resumen muestra partidos realmente jugados, asistencias, faltas justificadas/injustificadas y registros pendientes. Incluye fichas inactivas para conservar historial.
- El administrador puede corregir registros historicos de partidos finalizados. Se conserva quien hizo la ultima modificacion y cuando (`recorded_by`, `recorded_at`); no es un historial inmutable de todas las ediciones.

Solo owner, admin y entrenador pueden consultar la asistencia del equipo y registrarla; se conserva el acceso global de plataforma por los helpers existentes. Capturista no puede editar asistencia. Solo owner/admin (y acceso global existente) pueden vincular cuentas. No se cambian permisos de partidos ni captura de goles.

## Reglas de estadisticas

- Goles y tarjetas personales provienen de eventos no anulados de partidos finalizados. Las tarjetas se muestran como amarillas y registros de expulsion/roja segun el catalogo existente.
- Un partido jugado exige convocatoria distinta de No convocada, asistencia Presente, participacion Jugo y partido finalizado. Asistir como suplente sin entrar no suma un partido jugado.
- Una falta exige convocatoria y asistencia marcada explicitamente en un partido finalizado. No se calculan faltas automaticamente.
- Partidos cancelados, descansos, jugadoras no convocadas y registros sin validar no suman faltas. Una ausencia justificada se muestra separada de una injustificada.
- El resumen no asigna etiquetas de compromiso ni penalizaciones automaticas.
- El calendario personal muestra tambien partidos del equipo sin convocatoria para esa jugadora; no habilita confirmacion hasta que el entrenador la convoque.
- Las respuestas solo se pueden cambiar mientras el partido permanezca programado. Al retirar y volver a convocar se reinicia la disponibilidad.
- Los filtros de fechas incluyen ambos extremos. Los partidos sin fecha quedan fuera cuando se usa un limite de fechas.

## Correccion de datos anteriores

La vista original `v_player_stats.matches` contaba todos los partidos finalizados del equipo para cada jugadora. La migracion conserva sus columnas y corrige solamente ese contador, usando participacion validada de `match_rosters`.

Por eso los partidos jugados historicos pueden bajar a cero hasta registrar la participacion. No se inventan asistencias a partir de goles, alineaciones o plantillas antiguas. Los registros antiguos de convocatoria quedan con asistencia pendiente y `played=false`.

La funcion `player_match_count` permite publicar el total deportivo sin hacer publica la asistencia detallada. Conserva la visibilidad publica de equipos habilitados y el acceso organizacional existente.

## Seguridad

- Todos los RPC fijan `search_path=public`, revocan EXECUTE de PUBLIC/anon y validan permisos en backend.
- `player_dashboard(team)` determina la ficha por `auth.uid()`, vinculacion y membresia activa; no acepta ID de otra jugadora.
- `set_my_availability(match,value)` actualiza solo la convocatoria propia. No acepta correo, rol, asistencia ni participacion.
- `set_match_attendance` verifica coincidencia de equipo entre partido y jugadora, permisos del entrenador y coherencia de convocatoria/asistencia/participacion.
- La vinculacion no es editable directamente por el cliente. Se rechazan cuentas sin membresia y fichas de otras organizaciones.
- RLS impide lectura publica de `match_rosters` y restringe a cada jugadora a sus registros. Se verifica tambien la coherencia de referencias de equipo para ocultar registros antiguos inconsistentes.
- Se revoca escritura directa de `match_rosters` para clientes. Las escrituras pasan por RPC. Esto cambia el contrato de cualquier integracion externa que escribiera directamente esa tabla; no habia un consumidor de esa tabla en los servicios frontend existentes del repositorio.
- Deshabilitar la membresia, ficha, equipo u organizacion bloquea la consulta personal. La pantalla no crea permisos mediante botones ocultos ni datos locales.
- El modulo requiere Supabase: en modo demo muestra un aviso y no simula guardados exitosos. El modo demo deportivo anterior permanece intacto.

## Pruebas

```powershell
npm ci
npm run check
npm test
npm run test:edge
```

`tests/player-panel.test.cjs` ejecuta la migracion dos veces en PostgreSQL embebido y prueba permisos de owner, entrenador, capturista, jugadora y anonimo; vinculacion; separacion por equipos; cuenta deshabilitada; asistencia; disponibilidad y conteo de participacion. `tests/player-panel-ui.test.cjs` prueba los resumenes y el contrato del servicio personal.

Prueba manual recomendada con cuentas reales tras desplegar:

1. Invitar dos jugadoras viewer y vincular cada una a su ficha. Intentar vincular la misma cuenta a otra ficha del mismo equipo: debe fallar.
2. Convocar a ambas para un partido programado. Confirmar disponibilidad de una en otra sesion; la otra debe seguir Sin respuesta.
3. Intentar registrar asistencia desde la cuenta de jugadora mediante RPC o UPDATE directo: debe fallar. Intentar consultar otro equipo o la asistencia de la otra jugadora: no debe obtenerla.
4. Iniciar/finalizar el partido y marcar a una Presente/Jugo y a la otra Falta justificada. Comprobar contadores y goles.
5. Cancelar otro partido, dejar una convocatoria sin registrar y excluir a otra jugadora: ninguno debe producir falta automatica.
6. Comprobar filtros, correcciones, desvinculacion y acceso desde movil. Sin ficha vinculada debe aparecer el estado correspondiente, sin datos de otra persona.

Las pruebas automatizadas y de navegador usan datos locales/simulados. La migracion y las cuentas de produccion no se modificaron durante la implementacion. Revisar politicas/triggers adicionales no versionados antes de aplicarla a la base real.