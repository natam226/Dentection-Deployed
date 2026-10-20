# Dentection: sistema visual de trabajo

Decision de implementacion dentro del diseno aprobado: preservar el azul del proyecto y crear una superficie Operate. El profesional debe ver la radiografia y los hallazgos como centro de la tarea.

## Superficies y jerarquia

Cabecera blanca compacta con nombre y cuenta; navegacion lateral con Nuevo analisis e Historial. Fondo azul muy claro, texto azul oscuro y azul #274675 para acciones. Visor oscuro para la radiografia, con resultados en una columna contigua y notas debajo. Historial como lista o tabla de estudios, no mosaico decorativo.

## Tipografia y controles

Tipografia legible de la plataforma para esta herramienta, tamano base 15-16px, titulos compactos de 26-32px. Numeros tabulares en resultados. Botones de 42px o mas; foco visible, labels completos, contraste AA. Separadores finos, radios de 8px en controles, 12px en visor. Verde reservado para guardado confirmado y rojo para errores.

## Comportamiento

Al iniciar se explica que el calculo se realiza en el navegador. El primer analisis muestra la descarga y preparacion del modelo. Estados vacio, cargando, error, pendiente de guardar, guardado y sin detecciones tienen texto propio. No simular resultados. En anchos pequenos la navegacion se compacta y resultados/visor se apilan sin perder controles ni exportacion.

## Movimiento

Solo transiciones breves de foco y color y un indicador de actividad durante operaciones. Respetar prefers-reduced-motion. Sin decoraciones, fotografias de stock ni cifras comerciales.

## Acceso y registro

Formulario Operate de una columna sobre superficie blanca y fondo azul claro. Mantener #274675 en títulos, acciones y foco. Registro abierto con nombre, correo, contraseña y confirmación; inicio de sesión existente. Turnstile con tema claro, ancho flexible, idioma español y estado visible de carga, comprobación, expiración y reintento. Inputs de 16px en móvil; sin cambiar la paleta ni decorar la pantalla con ilustraciones.

El acceso, registro y recuperación de sesión ocultan navegación lateral y cabecera de cuenta desde el HTML inicial. La marca y el formulario quedan centrados; el espacio profesional se muestra solo tras autenticar.
