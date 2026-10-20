# Dentection


## Platform

web

## Users

Profesionales de salud oral que revisan radiografias panoramicas dentales y escriben observaciones para un informe descargable.

## Product Purpose

Subir una radiografia, consultar detecciones generales y detalladas del modelo existente, registrar observaciones profesionales y exportar el resultado a PDF. Cada profesional tiene una cuenta y un historial privado persistente en la nube.

## Stack

Propuesta aprobada en chat: TypeScript y Vite en Cloudflare Workers, D1, KV, Access OTP; modelo YOLOv8n existente exportado a ONNX y ejecutado en el navegador. Conservar Streamlit como referencia. Validar primero equivalencia del modelo.

## Capabilities and Constraints

Primera version en dos horas, usando cuotas gratuitas y sin activar planes de pago. Un estudio JPG/PNG de hasta 5 MiB por analisis. Sin nuevo entrenamiento, aplicaciones nativas, prescripciones automaticas ni envio al paciente. Login por correo autorizado y codigo temporal, historial por profesional, notas de texto y PDF. Nombre de paciente no obligatorio.

## Evidence on Hand

Repositorio Streamlit y modelo entrenado best_dental_kaggle.pt, 14 clases. Notebook con ejemplos y metricas historicas. No hay validacion clinica nueva ni testimonios; no inventar ninguno. Los resultados son detecciones del modelo que el profesional revisa.

## Brand Commitments

Nombre Dentection, interfaz en espanol. El codigo existente utiliza azul clinico #274675; conservarlo como referencia visual del producto.

## Product Principles

- Distinguir deteccion automatica de observacion profesional.
- Mostrar con claridad si el estudio y las notas estan guardados.
- Mantener privados los estudios de cada identidad autenticada.
- No volver a analizar al consultar o anotar resultados existentes.
