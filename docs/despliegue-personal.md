# Siguiente paso: publicar otherbloc

Destino aprobado: **Firestore en Firebase Spark + Cloudinary Free + Render Free**, con Firebase Hosting para React. Presupuesto: cero dólares, sin activar facturación. La adaptación local está preparada; todavía debe verificarse en las cuentas reales. No se han migrado datos ni hecho push.

## Orden de conexión

1. En [Firebase Console](https://console.firebase.google.com/), comprobar el ID del proyecto y mantener Spark. Preparar Firestore Standard, Native, base `(default)`; confirmar la región antes de crearla. No activar Storage, Blaze ni Firebase Authentication: otherbloc ya tiene su propio login. Revisar [reglas, índices e identidades](firebase-deployment.md).
2. En [Cloudinary](https://console.cloudinary.com/), mantener el plan Free y anotar el Cloud name. Configurar las credenciales únicamente en los servicios Users y Content de Render. Las fotos se subirán autenticadas; no hace falta un preset público ni una subida sin firma. [Configuración de imágenes](cloudinary-storage.md).
3. Revisar y autorizar el push del commit elegido a GitHub. La validación local no reemplaza el CI real de ese commit.
4. En [Render](https://dashboard.render.com/), crear los cuatro servicios separados de la plantilla: Users, Content, Interactions y Gateway, todos Free y en una región acordada. El generador `scripts/render-blueprint.mjs` exige región y plan; no importar el ejemplo con marcadores sin resolver. Mantener Auto Deploy y Blueprint Auto Sync desactivados hasta configurar la [entrega controlada](ci-cd.md#manual-production-workflow).
5. Configurar credenciales Firebase separadas por servicio, secretos internos coherentes, URLs HTTPS reales y el origen exacto de Hosting en `ALLOWED_ORIGINS`, nunca `*`. No copiar `.env.local` ni hosts de emuladores a producción. El gateway no recibe credenciales Firebase o Cloudinary.
6. Compilar el frontend con `VITE_API_URL=https://<gateway>/api` y `VITE_GRAPHQL_URL=https://<gateway>/api/interactions`. Firebase Hosting ya apunta a `frontend/dist` y resuelve rutas de React en `firebase.json`; no reinicializar esos archivos.
7. Acordar qué datos de demostración publicar y cómo crear el primer administrador. El despliegue no copia las cuentas, notas ni fotos locales. No ejecutar semillas o importaciones sobre datos existentes sin revisar su destino.
8. Comprobar registro, sesión tras recargar, portada e imagen, guardado, revisión, aprobación administrativa y lectura pública en escritorio/móvil. Verificar la revisión de los cuatro `/health` y de `/version.json`. Conservar las evidencias reales para el Design Lab y después preparar las diapositivas.

## Límites de la demostración gratuita

Render comparte 750 horas mensuales de instancias gratuitas por workspace y suspende servicios tras 15 minutos sin tráfico. Cuatro servicios activos permanentemente excederían esas horas; los arranques en frío pueden causar esperas o errores temporales. No es una garantía de disponibilidad continua. [Límites de Render](https://render.com/docs/free).

Firestore y Cloudinary tienen cuotas. No activar TTL, copias administradas, restauraciones ni otros servicios que requieran facturación para este proyecto. La caducidad de sesiones se comprueba en la aplicación; los registros vencidos requieren mantenimiento autorizado por separado. [Cuotas de Firestore](https://firebase.google.com/docs/firestore/quotas), [plan Cloudinary Free](https://cloudinary.com/pricing).

La franja editorial conserva Open-Meteo y Kraken. Las fuentes externas pueden desactivarse con `BULLETIN_EXTERNAL_ENABLED=false` en Content; permanecen los titulares propios.

Los IDs, regiones y URLs se pueden compartir para coordinar la configuración. Las claves privadas, contraseñas y tokens se introducen de forma privada en los destinos aprobados, nunca en el chat, frontend o Git.
