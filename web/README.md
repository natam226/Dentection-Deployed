# Dentection web

URL: https://dentection.natalia-moreno-mon.workers.dev

## Flujo

1. El profesional pulsa «Crear una cuenta», escribe nombre, correo y una contraseña de al menos 15 caracteres, la confirma y completa Turnstile. No se necesita invitación.
2. Inicia sesión, selecciona una imagen panorámica JPG/PNG (hasta 5 MiB y 40 megapíxeles) y el umbral de confianza.
3. El navegador descarga el modelo una vez y ejecuta la inferencia localmente. Guarda original, parámetros y resultados en Cloudflare.
4. Puede filtrar y seleccionar hallazgos, usar zoom, escribir observaciones y descargarlas junto con los resultados y la imagen en PDF.
5. El historial conserva los estudios entre sesiones. El PDF guarda primero las notas pendientes. Eliminar un estudio borra su registro y original.

## Componentes

- Vite + TypeScript + ONNX Runtime Web (WASM, un hilo) para el modelo YOLOv8n existente; no hay reentrenamiento.
- Workers Static Assets para interfaz, modelo y fuentes.
- Worker API con sesiones opacas de 8 horas; cookie `__Host-`, Secure, HttpOnly, SameSite=Strict. Solo se guarda el hash del token de sesión.
- D1 para cuentas, sesiones, estudios, notas, cuotas y límites de intentos.
- KV para originales; el API autoriza cada lectura por propietario y responde `private, no-store`.
- jsPDF con fuente Noto Sans local para acentos y documentos de varias páginas.

No se activó Zero Trust/Access: su alta gratuita solicitó tarjeta y la usuaria eligió login propio. El registro es público y Turnstile protege registro e inicio de sesión. No hay proveedor de correo/OTP. El correo identifica la cuenta; no se presenta como verificado. La recuperación de acceso sigue pendiente de un procedimiento administrativo. Nunca solicites contraseñas por chat.

## Ejecutar y verificar

Necesitas Node 22 o superior, pnpm y Python para exportar el modelo. Desde la raíz del repositorio:

```powershell
python -m venv .venv-export
.venv-export\Scripts\python -m pip install ultralytics onnx onnxruntime
.venv-export\Scripts\python scripts/export_model.py
cd web
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
pnpm run preview:local
```

`wrangler.local.jsonc` utiliza `worker/dev.ts` y una identidad ficticia exclusivamente en localhost para revisar la interfaz. No se despliega. La configuración de producción usa `worker/index.ts` y autentica sesiones reales. No existe un interruptor de bypass en producción.

Para probar cuentas localmente con la entrada de producción, crea `.dev.vars` con `AUTH_PEPPER` aleatorio de 32 bytes, aplica las migraciones localmente con `wrangler.jsonc` y ejecuta `pnpm exec wrangler dev`. Las cookies Secure funcionan en localhost en navegadores modernos; para integración se usa Miniflare.

## Desplegar

Los IDs del Worker/D1/KV ya apuntan a los recursos de esta aplicación en la cuenta propietaria. Para otra cuenta, crea tus propios recursos y cambia `wrangler.jsonc`.

```powershell
pnpm exec wrangler login
pnpm exec wrangler d1 migrations apply dentection-db --remote
pnpm exec wrangler secret put AUTH_PEPPER
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm run deploy
```

`AUTH_PEPPER` debe ser un secreto aleatorio de al menos 32 bytes; no debe estar en Git. Presérvalo: cambiarlo invalida la comprobación de las contraseñas existentes. Las contraseñas usan PBKDF2-SHA256 con sal aleatoria, 100.000 iteraciones (límite del runtime workerd), seguido de HMAC con ese secreto independiente. No se almacenan contraseñas en texto. Hay límite de 10 intentos por correo y 50 por IP cada 15 minutos, también para registro; los contadores expiran.

Las migraciones se aplicaron a la base remota. Las muestras de equivalencia se guardan solo en `work/parity`, fuera de archivos públicos. El servidor local de Vite las sirve en `/proof/`; la compilación rechaza un directorio `public/proof`.

El archivo ONNX y el runtime WASM se generan localmente y están ignorados por Git; `pnpm build` avisa si falta el modelo. Los pesos `.pt` originales están en el repositorio.

## Registro abierto y Turnstile

La pantalla ofrece «Iniciar sesión» y «Crear una cuenta». El Worker valida cada token con Siteverify, comprueba `success`, el hostname de la solicitud y la acción `register` o `login`. Tokens ausentes, falsos, vencidos, repetidos o de otra acción/dominio no crean cuentas ni sesiones. Fallos de red o falta del secreto bloquean la operación con opción de reintento.

`TURNSTILE_SITE_KEY` es pública y está en `wrangler.jsonc`; `TURNSTILE_SECRET_KEY` se guarda como secreto del Worker. El widget real solo admite `dentection.natalia-moreno-mon.workers.dev`, en modo Managed y sin pre-clearance. Para otro dominio, actualiza los hostnames permitidos del widget. Nunca publiques el secreto en Git ni uses claves de prueba en producción.

Cada registro crea perfil y cuenta en una transacción; un correo duplicado no deja perfiles huérfanos. Las cuentas anteriores conservan sus IDs, contraseñas y estudios. La tabla antigua de invitaciones queda sin uso para evitar modificar datos de las cuentas existentes.

El correo no se verifica por OTP y no se comprueba una licencia profesional. Turnstile reduce automatización; no acredita la identidad profesional. No se ha añadido recuperación de contraseña por correo.

Pruebas locales: `pnpm test` usa un Siteverify simulado en el límite de red y bases D1 reales de Miniflare para verificar fallos, duplicados y separación entre cuentas. El emulador visual `preview:local` conserva su identidad ficticia solo en localhost para revisar el área de radiografías. La verificación real se comprueba en el dominio publicado con el widget real; no hay bypass de Turnstile en la configuración de producción.

## Límites y recuperación

- Cuota de demostración: 500 MiB de originales en total, 200 cargas diarias en total y 50 por profesional; día UTC. Los contadores diarios no se reinician al borrar estudios.
- D1 reserva la capacidad antes de subir a KV. Si se interrumpe la red, «Reintentar guardado» usa el mismo identificador sin volver a analizar. Un estudio pendiente se puede eliminar desde el historial.
- KV tiene consistencia eventual. Al abrir desde otra ubicación inmediatamente después de guardar puede responder que la imagen sigue sincronizándose; vuelve a abrir tras unos segundos.
- Si vence la sesión durante el trabajo, la misma página permite iniciar sesión con la misma cuenta y reintentar sin perder la imagen ni el texto.
- La eliminación conserva un registro técnico sin notas ni nombre de archivo hasta confirmar el borrado de KV. Si falla KV, el historial muestra «Eliminación pendiente» y permite reintentar; la cuota no se libera antes de completar el borrado.
- Las notas incluyen revisión optimista: una edición desactualizada de otra pestaña produce un conflicto en vez de sobrescribir silenciosamente.
- El historial carga páginas de 50 estudios, muestra el total y permite cargar anteriores. La búsqueda por nombre filtra las páginas cargadas; la interfaz avisa si quedan estudios por cargar.
- El primer análisis descarga unos 27 MB de modelo y WASM; tarda más que los siguientes. En celulares la duración depende del dispositivo y memoria.
- El plan gratuito tiene cuotas propias de solicitudes, CPU, D1 y KV; la aplicación no es ilimitada. No se activó facturación de pago.

## Evidencia de verificación

Se comparó el ONNX en Chromium WASM con Python sobre el mismo tensor: 9 detecciones en ambos, error máximo de caja 0,441 píxeles y de confianza inferior a 0,000001. La imagen de prueba proviene de una figura del notebook existente y solo prueba el funcionamiento; no mide exactitud clínica. El preprocesamiento con canvas puede variar ligeramente respecto a OpenCV.

Las pruebas automatizadas cubren decodificación/NMS, autenticación, invitaciones, propiedad entre cuentas, carga/reintentos, notas concurrentes, validación y cuotas. La revisión local abrió un estudio guardado, filtró detecciones, usó zoom, guardó texto con acentos y generó un PDF de dos páginas inspeccionado visualmente. También se verificaron registro/login/logout y revocación en el Worker real.

Es un prototipo académico con el modelo original. Las detecciones requieren interpretación profesional; no se ha hecho validación clínica adicional ni auditoría para uso asistencial con datos reales.
