# Siguiente paso: publicar otherbloc

La aplicación sigue siendo local. Esta guía no significa que Render, Firebase ni GitHub estén configurados. No se ha hecho push, creado recursos, migrado datos ni activado facturación.

## Primero, las decisiones

- Elegir el proyecto real de Firebase, las regiones de Firestore/Storage y la región/plan de Render. `demo-otherbloc` es únicamente local.
- Cloud Storage para las fotos requiere **Blaze con facturación vinculada**, aunque pueda incluir uso sin coste. No equivale a una garantía de factura cero. [Requisito oficial](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
- Render Free comparte **750 horas mensuales por workspace** y suspende cada servicio tras 15 minutos sin tráfico. Cuatro servicios no pueden estar activos todo el mes dentro de esas 750 horas; sus arranques en frío también pueden producir esperas o errores temporales entre servicios. Conviene distinguir una demostración gratuita de una aplicación siempre disponible. [Límites oficiales](https://render.com/docs/free).
- Revisar qué notas/cuentas/fotos locales quieres llevar. El despliegue no las copia; la migración y su respaldo deben acordarse por separado. No ejecutar semillas ni reinicializar sobre tus datos.

## Orden de conexión

1. **Firebase:** preparar Firestore `(default)` y el bucket de Storage, revisar reglas/índices e identidades de servicio. Se conserva el login propio de otherbloc; no hay que sustituirlo por Firebase Authentication. Seguir [configuración de Firebase](firebase-deployment.md).
2. **GitHub:** revisar y autorizar tú el push del commit elegido. Configurar las protecciones y comprobar el CI real de ese mismo commit; las pruebas locales no lo sustituyen.
3. **Render:** preparar los cuatro servicios separados: Users, Content, Interactions y Gateway. La plantilla `deploy/render.blueprint.example.json` todavía tiene región/plan sin elegir; no importarla directamente. El generador local `scripts/render-blueprint.mjs` exige ambas decisiones. Mantener desactivados Auto Deploy y Blueprint Auto Sync. Seguir [guía de Render](render-deployment.md).
4. **Variables privadas:** Firebase project/bucket y credenciales separadas para los servicios propietarios; `JWT_SECRET` y `SERVICE_AUTH_SECRET` coherentes entre servicios; URLs HTTPS reales para comunicar los servicios. El gateway no recibe credenciales Firebase. `ALLOWED_ORIGINS` debe incluir el origen exacto de Hosting, nunca `*`. No copiar `.env.local` a producción ni configurar allí hosts de emuladores.
5. **Frontend:** compilar con `VITE_API_URL=https://<gateway>/api` y `VITE_GRAPHQL_URL=https://<gateway>/api/interactions`. Firebase Hosting ya apunta a `frontend/dist` y resuelve las rutas de React en `firebase.json`; no volver a inicializar el proyecto para crear estos archivos. El flujo preparado de [entrega controlada](ci-cd.md#manual-production-workflow) publica primero los servicios y después Hosting, con aprobación y credenciales de despliegue separadas.
6. **Aceptar la versión pública:** comprobar registro, cookie tras recargar, escritura, subida de portada, guardado, revisión administrativa y lectura pública en escritorio/móvil. Comparar la revisión de los cuatro `/health` y de `/version.json`. No dar por conectado Firebase solo porque el frontend abre.

La franja utiliza Open-Meteo sin clave para uso no comercial y el ticker público de Kraken; no necesita cuentas nuevas. Si otherbloc empieza a monetizarse, revisar los términos de datos o desactivar las fuentes externas con `BULLETIN_EXTERNAL_ENABLED=false` en Content. Los titulares propios permanecen. Las fuentes y tiempos de actualización están en el botón de información de la franja.

Para continuar hacen falta esas elecciones y autorización explícita para las operaciones externas. Nunca pegues claves privadas ni contraseñas en el chat o el repositorio.
