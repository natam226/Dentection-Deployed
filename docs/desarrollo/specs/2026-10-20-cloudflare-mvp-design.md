# Dentection: primera version web en Cloudflare

Fecha: 2026-10-20. Estado: propuesta para aprobacion; no autoriza todavia implementacion.

## Intencion y restricciones confirmadas

La profesional quiere acceder a Dentection desde un enlace en el navegador, sin depender de que su computador permanezca encendido. La primera version debe permitir iniciar sesion por profesional, subir una radiografia panoramica, analizarla con el modelo actual, consultar resultados generales y detallados, guardar anotaciones de texto y descargar un PDF. El historial de cada profesional debe conservarse en la nube y ser privado. El plazo indicado es de dos horas. Se prioriza aprovechar servicios gratuitos de Cloudflare; no activar planes de pago ni facturacion por decision del implementador. La usuaria ya tiene cuenta de Cloudflare, pero este entorno no tiene acceso de despliegue configurado.

La usuaria aclaro que quiere una aplicacion de navegador. No se desarrollaran aplicaciones nativas. No se promete validacion en dispositivos fisicos que no esten disponibles durante la entrega.

## Alcance propuesto y decisiones del autor

Estas son decisiones tecnicas propuestas, pendientes de aprobacion junto con el documento:

- Reutilizar `modelo/best_dental_kaggle.pt`, sin entrenar ni cambiar los pesos. Exportarlo a ONNX para ejecutar inferencia en el navegador con ONNX Runtime Web. La aplicacion, las identidades y el historial se alojan en Cloudflare; el dispositivo del profesional realiza el calculo de deteccion. Este reparto debe ser comunicado claramente.
- Crear una interfaz web sencilla en TypeScript con Vite, conservando la aplicacion Streamlit como referencia. El estilo fino y la organizacion interna quedan al implementador. Mantener espanol, buena legibilidad y comportamiento adaptable al ancho disponible.
- Workers con Static Assets sirve la interfaz y las rutas API. D1 guarda perfiles, estudios, detecciones y notas. Workers KV almacena los archivos de radiografia originales para esta demostracion pequena. KV evita requerir una suscripcion R2; no se activaran Containers ni R2 de pago.
- Login con Cloudflare Access y codigo temporal enviado al correo (OTP), en lugar de implementar contrasenas. Primera version para profesionales autorizados por una lista de correos; no incluye registro publico. Cada correo autenticado obtiene un perfil e historial propio. Configurar inicialmente el correo que la usuaria seleccione durante el acceso a Cloudflare; se podran agregar otros desde Access. Confirmar disponibilidad de Access gratuito en la cuenta antes de habilitarlo; no aceptar una suscripcion de pago.
- Usar una direccion gratuita `workers.dev`. No comprar ni transferir dominios.

## Primera comprobacion: viabilidad del modelo

Antes de implementar el resto, exportar el modelo y probar inferencia real en un navegador disponible. Validar dimensiones, clases y coordenadas con el mismo preprocesamiento y parametros en Python y ONNX. Usar una imagen de muestra existente o autorizada, nunca generar hallazgos ficticios para aparentar que el modelo funciona.

El modelo YOLOv8n tiene 14 clases. Obtener los identificadores y nombres de los metadatos del modelo, con traducciones de presentacion separadas. Reproducir redimensionado con letterbox, conversion RGB, normalizacion, salida YOLOv8 y NMS por clase; no tratar su salida como si tuviera una columna adicional de objectness. Fijar el mismo umbral de confianza y de IoU para la comparacion. Usar entrada estatica 640 por 640 y comparar con Python configurado para el mismo padding. Mantener los resultados al filtrar o escribir notas, sin ejecutar de nuevo inferencia.

Si exportacion, compatibilidad o equivalencia fallan, detener esta ruta y explicar el problema antes de sustituir el modelo, contratar un servidor, reducir funciones o publicar resultados simulados. No hay un servidor gratuito alternativo aprobado.

## Comportamiento funcional

1. Access verifica el correo del profesional con OTP. La API obtiene identidad autenticada y no acepta un identificador de usuario proporcionado por el cliente como prueba de identidad.
2. El profesional ve su perfil basico (correo y nombre editable si el tiempo lo permite) y su historial, ordenado de mas reciente a mas antiguo.
3. Puede subir una imagen JPG, JPEG o PNG; limite inicial de 5 MiB por estudio, con validacion del contenido y error claro ante archivos ilegibles. Se sube un archivo por analisis. No convertir ni recomprimir permanentemente la radiografia original para almacenarla.
4. La web muestra progreso, ejecuta el detector y presenta radiografia con cajas, resumen por clase, total de hallazgos y tabla de clase y confianza. Incluye umbral de confianza y seleccion de hallazgo para localizarlo. Con cero hallazgos, mostrar que el modelo no detecto resultados con ese umbral, sin afirmar ausencia de enfermedad.
5. El estudio se guarda en la nube despues del analisis exitoso, con original, fecha, nombre, version del modelo, parametros y detecciones. Solo mostrar confirmacion de guardado cuando el servidor confirme; si falla, conservar el trabajo en la vista y ofrecer reintento.
6. Cada estudio admite un campo de observaciones de texto editable con boton Guardar. Al reabrirlo desde el historial se recuperan resultados y notas; no se necesita volver a analizar. Los estudios usan UUID, no el nombre del archivo, como identificador.
7. El PDF se genera al solicitarlo, con radiografia marcada, fecha, profesional, resultados generales y detallados y observaciones guardadas. Distinguir detecciones automaticas de observaciones del profesional. No generar tratamientos ni medicamentos. El profesional descarga y comparte el archivo por su cuenta; no hay envio automatico ni portal de pacientes.

## Datos, identidad y limites

Tablas minimas: profesionales (identidad de Access, correo y nombre); estudios (UUID, profesional propietario, nombre original, clave KV, fecha, estado, version del modelo, parametros, detecciones JSON y notas). Las notas viven en D1; la imagen usa una clave KV unica e inmutable. PDF generado a demanda, sin almacenar copias adicionales.

Toda lectura, descarga, cambio de nota o borrado comprueba en el servidor que el estudio pertenece a la identidad autenticada. No confiar en correos o cabeceras de identidad enviados libremente: usar identidad proporcionada por Access al Worker o verificar la firma, issuer y audience de su JWT. Si Access no esta configurado, rechazar acceso al historial; no publicar un modo demo con acceso irrestricto a radiografias.

Evitar cache publico de radiografias, API o notas. No incluir archivos de pacientes en Git, logs ni servicios publicos. Las claves de infraestructura permanecen fuera del frontend y del repositorio. Un nombre de paciente no es obligatorio: el nombre o alias del estudio basta en esta version.

Limites gratuitos comprobados: KV ofrece 1 GB de almacenamiento y 1000 escrituras diarias; D1 5 GB totales y cuotas de consultas; Workers Free limita el tiempo de CPU por invocacion. KV tiene consistencia eventual: la vista actual conserva la imagen mientras se propaga y, al reabrir, debe manejar temporalmente una imagen aun no disponible sin declarar perdido el estudio. Reservar margen de almacenamiento y rechazar nuevas cargas al alcanzar el limite de aplicacion (propuesto 500 MiB totales de imagenes), con mensaje explicito. El implementador puede reducir el maximo de cargas diarias para evitar agotar la cuota, sin eliminar estudios silenciosamente. No se promete coste cero ante cualquier volumen de uso.

## Validacion y entrega

- Comprobar equivalencia razonable de predicciones Python/ONNX sobre la misma imagen, con diferencias documentadas y sin afirmar mejora de precision.
- Probar en navegador login, carga, inferencia, guardado, reapertura, edicion de notas y descarga de un PDF legible.
- Usar dos identidades de prueba para verificar que una no puede leer ni modificar estudios de otra, incluyendo peticiones API directas; si no hay dos correos disponibles, ejecutar pruebas de autorizacion automatizadas y declarar pendiente la comprobacion completa con dos sesiones reales.
- Comprobar imagen invalida, ausencia de detecciones, sesion expirada y error de guardado. Revisar un ancho pequeno y uno de escritorio; no afirmar pruebas en celulares fisicos inexistentes.
- Entregar URL si el despliegue queda autenticado y verificado, instrucciones de inicio, cambios realizados y limites pendientes. No anunciar publicado si falta el acceso a Cloudflare o la configuracion de Access.

La ventana de dos horas es un objetivo, no garantia. Priorizar una ruta completa probada sobre extras. Si una dependencia consume el plazo o una parte queda incompleta, informarlo sin sustituir silenciosamente el historial en la nube por almacenamiento local.

## Fuera de esta entrega

Nuevo entrenamiento, comparacion de arquitecturas, aplicacion nativa, registro publico, gestion clinica completa de pacientes, envio de correos al paciente, prescripciones automaticas, equipos de clinica con historiales compartidos y disponibilidad garantizada para uso asistencial real.

## Acceso y flujo de aprobacion

La usuaria completara personalmente el inicio de sesion de Cloudflare cuando sea necesario; no pedir contrasenas ni tokens en el chat. Antes de publicar, preparar y comprobar el resultado localmente, y usar solo recursos nuevos del proyecto. No modificar servicios o politicas ajenos.

Tras revisar y aprobar este documento: crear un plan breve, comprobar ONNX primero y avanzar con la implementacion. Si la usuaria prefiere otra arquitectura o login con contrasena, revisar el alcance y el tiempo antes de construir.

## Fuentes tecnicas

- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- https://developers.cloudflare.com/kv/platform/pricing/
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://onnxruntime.ai/docs/tutorials/web/
- https://docs.ultralytics.com/integrations/onnx/
