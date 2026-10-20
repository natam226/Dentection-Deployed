# Dentection

Aplicación: [Abrir Dentection](https://dentection.natalia-moreno-mon.workers.dev).

Revisión asistida de radiografías panorámicas dentales en el navegador de escritorio o móvil. Incluye registro abierto con correo, contraseña y Turnstile, historial privado por profesional, análisis con el modelo original, visor de hallazgos, observaciones y descarga de PDF.

## Estructura actual

- `web/`: interfaz TypeScript/Vite, API de Cloudflare Workers, migraciones D1, pruebas y configuración de despliegue.
- `modelo/best_dental_kaggle.pt`: pesos originales utilizados para generar el modelo ONNX del navegador.
- `modelo/detection_model_yolov8.ipynb`: notebook original y fuente de la muestra usada en la comparación técnica del modelo.
- `scripts/export_model.py`: exportación ONNX y generación de datos locales de comparación Python/navegador.
- `requirements.txt`: dependencias opcionales de Python para esa exportación.
- `docs/`: diseño, planes y evidencia del trabajo realizado.
- `PRODUCT.md` y `DESIGN.md`: alcance y sistema visual vigentes.

La interfaz anterior de Streamlit, sus utilidades, su configuración de despliegue y las cachés Python versionadas se retiraron. El código anterior sigue disponible en el historial de Git.

## Desarrollo de la aplicación

Necesitas Node.js 22 o superior y pnpm. Desde `web/`:

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Para preparar el modelo si falta `web/public/model/model.onnx`, desde la raíz:

```powershell
python -m venv .venv-export
.venv-export\Scripts\python -m pip install -r requirements.txt
.venv-export\Scripts\python scripts/export_model.py
```

El modelo exportado, el runtime WASM, las dependencias, las compilaciones y los archivos temporales no se versionan. Los pesos y el notebook sí se conservan para reproducir la exportación y permitir trabajo posterior sobre el modelo.

Consulta [web/README.md](web/README.md) para el arranque local, Cloudflare, secretos, límites y recuperación. La pantalla de acceso y registro no muestra la navegación del espacio profesional; esta aparece tras autenticar la sesión.

## Alcance

El correo aún no se verifica y no existe recuperación de contraseña. El prototipo conserva las cuotas documentadas y las detecciones requieren interpretación profesional. La comparación con Python verifica equivalencia técnica; no constituye validación clínica.

## Equipo Dentection

Proyecto original de 2025, desarrollado por:

- [Valentina Bueno Collazos](https://github.com/valentinabc19)
- [Liseth Esmeralda Erazo Varela](https://github.com/memerazo)
- [Natalia Moreno Montoya](https://github.com/natam226)
