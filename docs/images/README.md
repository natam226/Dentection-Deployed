# Capturas de Dentection

Imágenes para la documentación del repositorio. Son capturas de la interfaz real, sin edición del contenido visual.

| Archivo | Vista | Procedencia |
| --- | --- | --- |
| `01-iniciar-sesion.jpg` | Inicio de sesión | Captura existente de la interfaz publicada después de retirar la navegación del acceso. Campos vacíos. |
| `02-cargar-radiografia.jpg` | Nuevo análisis | Captura del entorno local con `wrangler.local.jsonc`. |
| `03-resultados-observaciones.jpg` | Resultados, notas y descarga de PDF | Captura del entorno local con un estudio de demostración preparado para documentar el visor. |
| `04-historial.jpg` | Historial | Captura del mismo estudio local después de guardar las observaciones. |

## Muestra utilizada

La imagen de demostración es la primera figura PNG incrustada en `modelo/detection_model_yolov8.ipynb`, que ya forma parte del repositorio público. Es un montaje de ejemplos del notebook, no una radiografía nueva aportada por un paciente.

El estudio local se preparó mediante la API con las nueve detecciones registradas en la comprobación previa de equivalencia de ONNX Runtime Web, sobre esa misma figura. No se inventaron hallazgos ni se ejecutó una nueva evaluación clínica para estas capturas. Las observaciones se escribieron y guardaron desde la interfaz y están identificadas como demostración técnica.

La identidad `revision-local@example.test` es ficticia y corresponde al modo local documentado en el README. Las capturas no utilizan cuentas ni estudios guardados por profesionales en el despliegue de Cloudflare.

## Actualización

Arranca el entorno local siguiendo el README principal, utiliza únicamente muestras autorizadas para publicación y captura las vistas de carga, revisión e historial. El acceso debe capturarse con los campos vacíos. Conserva los nombres de archivo para mantener los enlaces o actualiza sus referencias en el README.
