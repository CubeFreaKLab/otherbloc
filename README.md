# otherbloc

Plataforma editorial para publicar y leer artículos, gestionar el proceso de revisión e interactuar con autores. React + Vite, JavaScript y CSS; Fetch para REST y Apollo Client para GraphQL. Conserva una identidad tipográfica con Prumo, Adelle Sans y Georgia, temas claro/oscuro/sistema y navegación accesible en escritorio y móvil.

El producto está integrado y verificado localmente con Firestore y Storage de Firebase Emulator Suite. La configuración de Firebase Hosting, Render y GitHub Actions está preparada, pero **todavía no hay despliegues ni ejecuciones de Actions acreditados**. Los datos del emulador no son evidencia de persistencia en Firebase real.

## Arquitectura

El navegador realiza todas las operaciones de datos a través del gateway. Hay exactamente tres microservicios, además del gateway:

| Aplicación | Puerto local | Responsabilidad |
| --- | --- | --- |
| Frontend | 5173 | Lectura, cuenta, editor y administración |
| API Gateway | 3000 | Entrada `/api`, validación, límites y comunicación con los servicios |
| Usuarios — REST | 3001 | Identidad, perfiles, sesiones, avatares y roles |
| Contenido — REST | 3002 | Publicaciones, bloques, imágenes y ciclo editorial |
| Interacciones — Apollo GraphQL | 3003 | Comentarios, reacciones, guardados, seguimiento y consultas compuestas |

El gateway dirige `/api/interactions` a `/graphql` de Interacciones. Cada servicio propietario accede a sus colecciones; Interacciones obtiene publicaciones y autores por las APIs de Contenido y Usuarios. Las imágenes se almacenan en Storage y sus referencias en Firestore. El frontend no recibe credenciales de Firebase ni accede directamente a los servicios propietarios. Más detalle en [arquitectura](docs/architecture.md), [gateway](docs/gateway.md) y [modelo de datos](docs/database.md).

## Arranque desde una instalación limpia

Requisitos: Git, Node.js 24 recomendado (mínimo 22.12), npm y Java 21 o superior para los emuladores. Se necesita conexión para instalar dependencias y descargar los binarios de Firebase en el primer arranque. No se requiere una cuenta de nube para el desarrollo local.

Clona el repositorio y ejecuta todos los comandos desde su raíz:

```bash
git clone https://github.com/CubeFreaKLab/otherbloc.git
cd otherbloc
npm ci
npm run setup:local
```

`setup:local` crea `.env.local` con secretos aleatorios y no sobrescribe un archivo existente. Los ejemplos de cada aplicación documentan sus variables, pero no contienen credenciales reales. No copies secretos locales a producción ni publiques el archivo privado.

En la primera terminal, inicia Firestore y Storage y espera a que estén listos:

```bash
npm run emulators
```

En una segunda terminal, inicia frontend, gateway y los tres servicios:

```bash
npm run dev
```

En una tercera terminal, cuando los servicios estén disponibles, crea los datos de demostración:

```bash
npm run seed:users
npm run seed:content
```

Abre [otherbloc local](http://127.0.0.1:5173). La [interfaz de los emuladores](http://127.0.0.1:4000) permite inspeccionar el entorno local. Firestore usa 8080 y Storage 9199; no inicies otra suite sobre los mismos puertos. En Windows, si Java 21 no está en PATH, configura `JAVA_HOME` o `OTHERBLOC_JAVA_HOME`; consulta [desarrollo local](docs/development.md#java-on-windows).

Para pruebas de integración o carga, inicia las aplicaciones con `node scripts/dev.mjs --no-watch` en lugar de `npm run dev`. El comportamiento del producto es el mismo, sin reinicios automáticos del backend durante la comprobación.

### Probar los tres roles

La carga inicial crea un lector, cuatro autores y un administrador, además de siete publicaciones variadas en español. Son datos sintéticos identificados con `demo=true`; no representan cuentas o publicaciones reales. Los scripts solo admiten el proyecto local `demo-otherbloc` y ambos emuladores: no son comandos de carga de producción.

Consulta **en tu archivo privado `.env.local`** los valores `SEED_READER_EMAIL`, `SEED_AUTHOR_EMAIL`, `SEED_ADMIN_EMAIL` y `SEED_PASSWORD`. Los correos predeterminados son `reader@example.test`, `author@example.test` y `admin@example.test`; la contraseña se genera durante la configuración y no aparece en este repositorio. Si ya sembraste las cuentas, cambiar esas variables no modifica las credenciales guardadas: volver a ejecutar el seed conserva cuentas existentes y rechaza colisiones ajenas.

Entra por `/login` y cierra la sesión antes de cambiar de rol:

| Rol | Recorrido sugerido |
| --- | --- |
| Lector | Editar perfil/avatar en `/account`; comentar, reaccionar, guardar una lectura y seguir a su autor. Recargar y comprobar `/account/saved` y `/account/following`; deshacer las interacciones disponibles. |
| Autor | Abrir `/author`, crear una publicación con portada y bloques, guardar, recargar y recuperar el borrador. Editar, previsualizar y enviar a revisión. |
| Administrador | Revisar en `/admin/publications` la publicación enviada, moderarla y comprobar su lectura pública. Gestionar solicitudes y permisos desde `/admin/users`. |

El registro público en `/register` crea lectores, nunca administradores. Los permisos y el estado actual de la cuenta se validan en el servidor; ocultar un botón no es el control de autorización. Los borradores no son públicos. Consulta [Usuarios](docs/users-service.md), [Contenido y transiciones](docs/content-service.md) e [Interacciones](docs/interactions-service.md) para los contratos y límites concretos.

### Conservar los datos locales

Antes de una intervención sobre el entorno puedes crear un respaldo independiente con:

```bash
npm run emulators:export
```

Para cerrar, detén las aplicaciones con Ctrl+C y luego los emuladores con Ctrl+C; espera a que termine la exportación. El siguiente arranque importa `.local-data/current`. Cerrar forzosamente el proceso no garantiza ese guardado. No borres la configuración, los snapshots ni los directorios temporales para hacer pasar una prueba. [Importación, exportación y restauración](docs/development.md#persistence-import-and-export) explica cómo seleccionar un respaldo sin modificar el original.

## Pruebas y build

Los contratos de Node, lint y el build no necesitan emuladores:

```bash
npm test
npm run lint
npm run build
```

El resultado de producción se escribe en `frontend/dist`, incluido `version.json` con la revisión y el estado del checkout; esto no publica el sitio.

Instala Chromium antes de las pruebas de navegador:

```bash
npx playwright install chromium
```

Con los emuladores, las aplicaciones y los datos iniciales activos:

```bash
npm run test:integration:running
npm run test:e2e
```

La integración API usa el proyecto separado `demo-otherbloc-test` dentro de los emuladores. Los recorridos E2E usan APIs reales del entorno local y crean cuentas `e2e-*` que permanecen disponibles para inspección. `npm run test:integration` es la alternativa que inicia sus propios emuladores: detén y exporta primero los de desarrollo.

`npm run test:ui` ejecuta la regresión visual/accesibilidad con **fixtures explícitos**; no sustituye las pruebas de persistencia. Puede reutilizar Vite localmente, pero con `CI=true` exige arrancar su propio servidor antes de los servicios del recorrido real. `npm run test:ci` exige un checkout desechable sin configuración ni snapshots previos; no lo ejecutes sobre tu entorno de trabajo. Consulta [pruebas](docs/testing.md) y [reproducción de CI](docs/ci-cd.md#reproduce-the-ci-commands-locally).

La [prueba k6](docs/load-testing.md) requiere instalar su binario por separado. Con el entorno local preparado, `npm run test:load` ejecuta 50 usuarios virtuales durante 60 segundos sin relajar los límites de seguridad. No la ejecutes a la vez que otras pruebas intensivas.

### Evidencia local disponible

Los hitos y sus alcances están registrados en [pruebas](docs/testing.md) y el [historial técnico](docs/development-log.md). No todos corresponden a una única ejecución del mismo commit:

- 75 comprobaciones de Node, lint y build pasan tras preparar la infraestructura Render.
- La última verificación completa de CI en un checkout nuevo pasó 22 pruebas visuales, 30 de API y 78 E2E de escritorio/móvil; se ejecutó en Windows, no en GitHub Actions. Los cambios posteriores de despliegue tienen contratos y revalidaciones acotadas propias.
- k6 local pasó 11.476 peticiones, sin fallos HTTP, con P95 de 31,63 ms (meta inferior a 400 ms). Es lectura con siete publicaciones en emuladores del mismo equipo; no mide rendimiento en nube.
- Se mantienen avisos moderados de dependencias y una oportunidad de mejora del LCP bajo red restringida; las pruebas satisfactorias no eliminan esas limitaciones.

## Despliegue: preparación y paso pendiente

Los destinos acordados son Firebase Hosting para el frontend y cuatro servicios web en Render para el gateway y los tres propietarios. La preparación está en [CI/CD](docs/ci-cd.md) y [Render](docs/render-deployment.md); los nombres de variables, sin valores reales, están en [deploy/.env.example](deploy/.env.example).

`deploy/render.blueprint.example.json` contiene región y plan sin elegir. El comando `node scripts/render-blueprint.mjs --region=<región-aprobada> --plan=<plan-aprobado>` prepara un `render.yaml` local y no sobrescribe uno existente ni crea recursos. No ejecutes la plantilla sin revisar primero los costos y las opciones con el propietario.

El primer push lo controla el propietario. Después de revisar la configuración, ese push permite ejecutar **Platform CI** realmente en GitHub. La provisión inicial de Firebase/Render requiere proyecto, región, permisos y costos aprobados; Storage requiere revisar la dependencia de Blaze y una cuenta de facturación. El workflow **Production release** necesita además el entorno `production` protegido y las credenciales de despliegue; vuelve a ejecutar CI del mismo commit, pide aprobación, actualiza Render secuencialmente y publica Hosting solo después de verificar sus cuatro servicios.

Todavía faltan la configuración autorizada de las cuentas, la carga inicial en Firebase real, ejecuciones reales de CI/CD, URLs verificadas y recorridos de lector/autor/administrador contra la versión desplegada. No hay enlaces de despliegue ni insignias de éxito ficticias. Los pasos que implican cuentas, credenciales, facturación o publicación requieren coordinación; no envíes contraseñas, claves privadas ni códigos de acceso por chat.

## Documentación

- [Desarrollo local](docs/development.md), [estructura del repositorio](docs/repository.md) y [pruebas](docs/testing.md).
- [Arquitectura](docs/architecture.md), [Firestore/Storage](docs/database.md), [REST del gateway](docs/gateway.md) y [GraphQL](docs/graphql.md).
- [Usuarios](docs/users-service.md), [Contenido](docs/content-service.md) e [Interacciones](docs/interactions-service.md).
- [Frontend](docs/frontend.md), [sistema visual](docs/design-system.md), [carga k6](docs/load-testing.md) e [historial técnico](docs/development-log.md).
- [CI/CD](docs/ci-cd.md) y [preparación Render](docs/render-deployment.md).

La configuración real, los datos locales y el registro académico con sus capturas permanecen privados y fuera de Git. Este README es la guía técnica del producto, no la acreditación final de su entrega en nube.
