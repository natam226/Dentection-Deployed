# Dentection web

URL: https://dentection.natalia-moreno-mon.workers.dev

## Flujo

1. El administrador genera una invitación vinculada a un correo. El profesional elige su nombre y contraseña de al menos 15 caracteres.
2. Inicia sesión, selecciona una imagen panorámica JPG/PNG (hasta 5 MiB y 40 megapíxeles) y el umbral de confianza.
3. El navegador descarga el modelo una vez y ejecuta la inferencia localmente. Guarda original, parámetros y resultados en Cloudflare.
4. Puede filtrar y seleccionar hallazgos, usar zoom, escribir observaciones y descargarlas junto con los resultados y la imagen en PDF.
5. El historial conserva los estudios entre sesiones. El PDF guarda primero las notas pendientes. Eliminar un estudio borra su registro y original.

## Componentes

- Vite + TypeScript + ONNX Runtime Web (WASM, un hilo) para el modelo YOLOv8n existente; no hay reentrenamiento.
- Workers Static Assets para interfaz, modelo y fuentes.
- Worker API con sesiones opacas de 8 horas; cookie `__Host-`, Secure, HttpOnly, SameSite=Strict. Solo se guarda el hash del token de sesión.
- D1 para cuentas, invitaciones, sesiones, estudios, notas, cuotas y límites de intentos.
- KV para originales; el API autoriza cada lectura por propietario y responde `private, no-store`.
- jsPDF con fuente Noto Sans local para acentos y documentos de varias páginas.

No se activó Zero Trust/Access: su alta gratuita solicitó tarjeta y la usuaria eligió login propio. No hay registro público ni proveedor de correo/OTP. El correo identifica la cuenta invitada; no se presenta como verificado. Invitaciones y recuperación de acceso requieren administración. Nunca solicites contraseñas por chat.

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
pnpm exec wrangler d1 migrations apply dentection-local --local --config wrangler.local.jsonc
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
pnpm run deploy
```

`AUTH_PEPPER` debe ser un secreto aleatorio de al menos 32 bytes; no debe estar en Git. Presérvalo: cambiarlo invalida la comprobación de las contraseñas existentes. Las contraseñas usan PBKDF2-SHA256 con sal aleatoria, 100.000 iteraciones (límite del runtime workerd), seguido de HMAC con ese secreto independiente. No se almacenan contraseñas en texto. Hay límite de 10 intentos por correo y 50 por IP cada 15 minutos, también para registro; los contadores expiran.

Las migraciones se aplicaron a la base remota. El archivo ONNX y el runtime WASM se generan localmente y están ignorados por Git; `pnpm build` avisa si falta el modelo. Los pesos `.pt` originales están en el repositorio.

## Invitar profesionales

Desde `web/`, con Wrangler autorizado:

```powershell
node scripts/invite.mjs profesional@ejemplo.com C:\ruta\privada\invitacion.txt
```

El script genera un código de 256 bits, guarda solo su hash en D1 y entrega el código en el archivo indicado. Es personal, de un solo uso y vence en 7 días. No subas invitaciones al repositorio. Para recuperación de contraseña, el administrador debe implementar o ejecutar un procedimiento seguro de restablecimiento que conserve el identificador del profesional y revoque sus sesiones; esta versión no tiene recuperación por correo.

## Límites y recuperación

- Cuota de demostración: 500 MiB de originales en total, 200 cargas diarias en total y 50 por profesional; día UTC. Los contadores diarios no se reinician al borrar estudios.
- D1 reserva la capacidad antes de subir a KV. Si se interrumpe la red, «Reintentar guardado» usa el mismo identificador sin volver a analizar. Un estudio pendiente se puede eliminar desde el historial.
- KV tiene consistencia eventual. Al abrir desde otra ubicación inmediatamente después de guardar puede responder que la imagen sigue sincronizándose; vuelve a abrir tras unos segundos.
- Las notas incluyen revisión optimista: una edición desactualizada de otra pestaña produce un conflicto en vez de sobrescribir silenciosamente.
- La lista de historial muestra los 200 estudios más recientes. No hay paginación en este prototipo.
- El primer análisis descarga unos 27 MB de modelo y WASM; tarda más que los siguientes. En celulares la duración depende del dispositivo y memoria.
- El plan gratuito tiene cuotas propias de solicitudes, CPU, D1 y KV; la aplicación no es ilimitada. No se activó facturación de pago.

## Evidencia de verificación

Se comparó el ONNX en Chromium WASM con Python sobre el mismo tensor: 9 detecciones en ambos, error máximo de caja 0,441 píxeles y de confianza inferior a 0,000001. La imagen de prueba proviene de una figura del notebook existente y solo prueba el funcionamiento; no mide exactitud clínica. El preprocesamiento con canvas puede variar ligeramente respecto a OpenCV.

Las pruebas automatizadas cubren decodificación/NMS, autenticación, invitaciones, propiedad entre cuentas, carga/reintentos, notas concurrentes, validación y cuotas. La revisión local abrió un estudio guardado, filtró detecciones, usó zoom, guardó texto con acentos y generó un PDF de dos páginas inspeccionado visualmente. También se verificaron registro/login/logout y revocación en el Worker real.

Es un prototipo académico con el modelo original. Las detecciones requieren interpretación profesional; no se ha hecho validación clínica adicional ni auditoría para uso asistencial con datos reales.
