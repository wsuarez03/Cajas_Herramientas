# Aplicación de control de herramientas (offline)

Aplicación web simple para checklist por caja/trabajador.

## Qué hace

- Carga una caja por `ID` (útil para abrir desde un QR).
- Muestra listado de herramientas.
- Permite validar cada herramienta como `OK` o `No OK`.
- Permite registrar observaciones por herramienta y observaciones generales.
- Guarda checklist e historial en el navegador (localStorage).
- Exporta historial en CSV.
- Funciona sin internet (service worker + caché de archivos).

## Uso rápido

1. Abra `index.html` con un navegador moderno.
2. Ingrese `ID Caja / Trabajador` y pulse **Cargar caja**.
3. Complete el checklist y pulse **Guardar checklist**.
4. Para exportar, pulse **Exportar historial CSV**.

## Uso con QR

- El QR puede contener una URL como:
  - `https://su-dominio/app/index.html?box=caja-juan`
- Al abrirla, la app carga automáticamente esa caja.

## Nota offline

Para que el modo offline sea consistente, abra una vez la app en el navegador con conexión para cachear los archivos.
