# Política de Privacidad y Consentimiento (Piloto)

Esta aplicación recolecta datos para informar sobre el paradero y tiempo de llegada de los buses. Todo el modelo está diseñado en base al principio de la privacidad desde el diseño (**Privacy by Design**), cumpliendo las regulaciones locales (Ley 1581 de 2012, Habeas Data, Colombia).

## 1. Qué datos recolectamos

- **Ubicación en tiempo real**: Solo se obtiene si el usuario pulsa "Compartir recorrido".
- **Datos de Viajes (Compartidos)**: Las rutas tomadas, el horario de operación, y la hora de parada. Todo asociado a un viaje (TripID) generado al azar en el lado cliente y anónimo. NO se asocia con el perfil de usuario.
- **Perfil (Opcional)**: Lugares frecuentes y horarios de clase.
- **Reportes (Incidencias/Ocupación)**: Información anónima compartida sobre un bus (por ejemplo: lleno, vacío, varado).

## 2. Tratamiento de los datos y Almacenamiento

- **Perfil y Cuenta**: Si no se registra (Auth), el perfil se guarda solo de manera local en el teléfono. Si hay cuenta registrada (mediante Supabase o Google), se guardará con un ID en nuestra nube para respaldo y acceso cross-device.
- **Ubicación**: Las coordenadas en tránsito (latitud y longitud) se purgan del sistema tan pronto como el viaje termina. Únicamente se conservan los tiempos de llegada a cada parada y el identificador de la ruta como insumo para el modelo predictivo, de forma completamente anónima.
- **Anti-abuso**: Mantenemos un histórico en memoria caché por un máximo de tiempo breve (horas) con el ID de la sesión del dispositivo, sin vincular a nombre o correo, solo para limitar reportes repetidos o maliciosos de una misma IP/Sesión.

## 3. Retención Limitada

- **Historial de Viajes**: Se retendrán las estadísticas del viaje (tiempos y rutas) con fines predictivos en el modelo de Machine Learning, siempre de manera anónima y agregada.
- **Reportes en tiempo real**: Todo reporte de incidentes y ocupación del bus **expira** del sistema y de las pantallas de la comunidad a los 30 minutos y 10 minutos, respectivamente.

## 4. Borrado de datos ("Borrar mis datos")

El usuario tiene habilitado en su app, dentro de la sección de Perfil, un botón claro para purgar todos sus lugares, horarios de clase y configuraciones, destruyendo la información localmente (y sincronizada para destruir la cuenta vinculada si corresponde).

_Nota: Para el cumplimiento legal final ante la SIC, este documento deberá ser revisado y formalizado por un abogado._
