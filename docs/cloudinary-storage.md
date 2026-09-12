# Fotografías con Cloudinary Free

La versión de Web III conserva Firestore como base de datos y usa Cloudinary para archivos en la configuración de nube. No modifica React, el editor, los puertos, los tres microservicios ni las rutas públicas. La configuración local sigue utilizando Firebase Storage Emulator.

## Variables del servidor

| Destino | Configuración |
| --- | --- |
| Users y Content | `MEDIA_STORAGE_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, proyecto y credencial Firebase |
| Interactions | `MEDIA_STORAGE_PROVIDER=cloudinary`, proyecto y su credencial Firebase; sin claves Cloudinary |
| Gateway y frontend | Sin credenciales Firebase ni Cloudinary |
| Local | Proveedor `firebase` por defecto, proyecto demo, bucket local y ambos hosts de emuladores |

En modo Cloudinary se rechazan `FIREBASE_STORAGE_BUCKET` y los hosts de emuladores para evitar una mezcla accidental de destinos. Las credenciales nunca usan el prefijo `VITE_`. No crear un preset de subida pública o sin firma. Confirmar el entorno Cloudinary antes de introducir sus claves en Render.

## Protección y compatibilidad

Los servicios validan las imágenes y las convierten a WebP con Sharp antes de subirlas. Se conservan los límites del producto, las descripciones accesibles y las variantes existentes. Los archivos usan tipo **authenticated**, no `upload` público ni `private` con derivados públicos. El SDK de Cloudinary firma las operaciones en el servidor.

Los identificadores son `otherbloc/<proyecto>/avatars/...` y `otherbloc/<proyecto>/publications/...`. Se conserva la referencia relativa de Firestore. Cada propietario limita los prefijos que admite; la clave Cloudinary en sí no constituye una separación de permisos por carpeta.

Antes de descargar, otherbloc comprueba la propiedad del borrador, su publicación o los permisos del administrador mediante las mismas APIs. Después obtiene una descarga temporal de 60 segundos en el servidor y devuelve los bytes. No entrega URLs firmadas al navegador ni las almacena en la base. La descarga rechaza redirecciones, respuestas no WebP y más de 10 MiB; tiene un plazo de ocho segundos. Las subidas no sobrescriben archivos existentes.

Firestore y Cloudinary no comparten una transacción distribuida. Si falla una referencia, se intenta retirar únicamente el archivo confirmado como nuevo por esa operación. Un fallo ambiguo no se reintenta ni se resuelve borrando un archivo desconocido. Los errores públicos no revelan detalles del proveedor o secretos.

Cambiar la variable no migra fotografías anteriores: una nube nueva no contiene los archivos del emulador. La migración o la carga inicial deben acordarse aparte, conservar el respaldo local y verificarse con las imágenes reales. Los archivos retirados de una nota y las sesiones caducadas necesitan mantenimiento controlado, no borrados automáticos.

## Verificación y límites

Las pruebas locales del adaptador comprueban firmas del SDK, prefijos, colisiones, limpieza, expiración, límites y errores con respuestas simuladas. No prueban la cuota, credenciales ni descarga real de una cuenta Cloudinary. Antes de aceptar el despliegue hay que subir una portada, guardar y recargar, probar acceso ajeno denegado y leer la imagen después de la aprobación administrativa.

El plan gratuito tiene límites de almacenamiento, transformaciones y transferencia compartidos por su sistema de créditos. Revisar el consumo en la cuenta y mantener Free; no activar ampliaciones pagadas. Las variantes se generan con Sharp para no depender de transformaciones dinámicas públicas.

Referencias: [SDK oficial Node.js](https://cloudinary.com/documentation/node_integration), [API de subida y descarga privada](https://cloudinary.com/documentation/image_upload_api_reference), [control de acceso](https://cloudinary.com/documentation/control_access_to_media), [planes](https://cloudinary.com/pricing).
