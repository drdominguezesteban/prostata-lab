/** Límites compartidos por el navegador y el servidor (sin datos de casos). */
export const MAX_LOTE = 300;
/** Tamaño máximo de un lote de `/api/recorregir`; el navegador corta los lotes por debajo. */
export const MAX_BYTES_LOTE = 1_500_000;
/** Tope de un archivo de progreso (exportación de un alumno): unos 2000 intentos con lesiones. */
export const MAX_BYTES_ARCHIVO = 2_000_000;
/** Tope de intentos en un archivo: siete casos, repetidos muchas veces, caben de sobra. */
export const MAX_INTENTOS_ARCHIVO = 1000;
