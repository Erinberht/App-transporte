# Piloto y Pruebas con Estudiantes (Unicórdoba)

Esta guía documenta los pasos para iniciar el programa de pruebas controladas (Piloto) de la App Mi Bus.

## 1. Alcance

- **Segmento inicial:** 50 a 100 estudiantes regulares de la Universidad de Córdoba (Sede Montería).
- **Plataforma Inicial:** Android (APK distribuida inicialmente por EAS Build en el perfil "preview" o "development").

## 2. Métricas de Éxito

Para considerar que la etapa de despliegue piloto es un éxito, rastrearemos de manera agregada:

- **Usuarios Activos Diarios (DAU):** Cantidad de estudiantes usando la aplicación.
- **Tasa de Viajes Compartidos (Share Rate):** % de usuarios que pulsan el botón "Compartir mi recorrido" una vez se suben al bus.
- **Precisión del ETA:** La diferencia media entre el tiempo de llegada reportado en tiempo real (por la comunidad) frente al tiempo real medido.
- **Volumen de Reportes Útiles:** Reportes de ocupación, bus lleno o varado que reciben interacción o no son descartados como atípicos (falsos positivos).

## 3. Seguimiento de Errores

Se debe integrar un flujo de reportes pasivo mediante un panel en App o directamente con el envío de logs a nuestro backend/sentry si el usuario lo decide.

## 4. Distribución

El enlace generado por Expo (EAS Build) o mediante `eas submit --platform android` para pruebas internas de Play Console (Internal Testing) será enviado vía canal cerrado a los participantes.
