# Avisos (etapa 4.2a)

Notificaciones **locales**, programadas en el teléfono con `expo-notifications`. No hay token de push ni servidor: nada sale del teléfono. Los avisos de retraso o de buseta varada con la app cerrada necesitan push remoto y quedan para la **4.2b** (Firebase/FCM, token en Supabase, Edge Function).

Se activan uno por uno en "Mi perfil" → "Avisos". Todos vienen **apagados** y el permiso de notificaciones se pide solo al activar uno (en Android 13+ primero se crea el canal "Avisos de viaje", si no el diálogo no aparece).

| Aviso                   | Cuándo llega                                                    | Texto (ejemplo)                                                                                     |
| ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Sugerencia de la mañana | 45 min antes de la hora de salir, para la primera clase del día | "Hoy: Cálculo a las 7:00 a. m." · "Sal de Casa a las 6:14 a. m. y toma la S1 en … a las 6:28 a. m." |
| Hora de salir           | 10 min antes de la hora de salir                                | "Sal en 10 min" · "Para tu Cálculo a las 7:00 a. m.: toma la S1 en … a las 6:28 a. m."              |
| Tu bus se acerca        | Mientras "Esperando tu bus" está abierta, antes de que pase     | "Tu T2 se acerca" · "Pasa por Calle 41 en unos 5 min (a las 6:12 a. m.)."                           |

## Cómo se calcula

- `src/notifications/plan.ts` (puro): `planDailyNotices` y `arrivalNotice`.
- **Mañana y salida:** solo la **primera** clase de cada día (para las demás ya estás en el campus). El origen es el primer lugar de tipo **Casa** del perfil. El motor de recomendación (`recommendRoutes`) da la **última salida** que llega con 10 min de colchón. Si conviene caminar, lo dice.
  - Sin Casa: solo un recordatorio 90 min antes de la clase ("Guarda tu Casa en Mi perfil…"). No hay aviso de salida.
  - Si ninguna ruta llega a tiempo desde Casa, la sugerencia lo dice.
- **Llegada:** avisa con tiempo para caminar a la parada (caminata + 2 min, mínimo 5 min antes). Usa la hora de paso del motor, corregida con los buses en vivo (`assessWaiting`). Se reprograma si esa hora cambia y se cancela al salir de la pantalla ("Ya subí"). Si ya está por sonar, no se toca.
- Las horas salen del horario de las rutas cargadas (hoy ficticio) y pueden variar unos minutos.

## Programación

- `src/notifications/scheduler.ts`: `startNotificationSync()` (en `_layout.tsx`) muestra los avisos también con la app abierta y sincroniza al arrancar, al cambiar el perfil y al volver a la app.
- Se programan **7 días** por adelantado como avisos de fecha única (`DATE`), con ids estables (`morning:2026-11-09`, `departure:…`, `arrival`). Cada sincronización cancela los de la mañana y salida y los vuelve a crear, así que no se duplican.
- "Borrar mi perfil" o apagar los avisos los cancela.
- Sin el permiso de alarmas exactas (`SCHEDULE_EXACT_ALARM`, que Google Play restringe), Android los entrega a una hora **aproximada**. Para avisos de 10 min se acepta; si en pruebas llegan muy tarde, se revisa.
- Ícono de la notificación: `assets/notification-icon.png` (blanco, 96 × 96, sacado del ícono monocromo).
