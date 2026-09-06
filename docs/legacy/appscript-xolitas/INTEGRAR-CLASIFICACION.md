# Conectar el panel de clasificación

1. En la constante `SHEETS` de `Code.gs` agrega:

```javascript
standings: 'Clasificacion'
```

2. Dentro de `routeGet_` agrega:

```javascript
case 'getStandings': return { data: getStandings_() };
```

3. Dentro de `routePost_`, después de validar la sesión, agrega:

```javascript
case 'createStanding': requireRole_(session, ['admin']); return saveStanding_(d, true);
case 'updateStanding': requireRole_(session, ['admin']); return saveStanding_(d, false);
case 'deleteStanding': requireRole_(session, ['admin']); return deleteStanding_(d.standingId);
```

4. Crea un archivo `Clasificacion.gs` en Apps Script y pega el contenido del archivo incluido en esta carpeta.
5. Guarda y ejecuta manualmente `prepararClasificacion()` una sola vez.
6. Publica una nueva versión desde **Implementar > Administrar implementaciones**.
7. Prueba `TU_URL/exec?action=getStandings`.

La hoja almacena solamente los datos necesarios. Jugados, puntos, diferencia, porcentaje y posición se calculan automáticamente.
