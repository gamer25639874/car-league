# Car Soccer — prototipo 3D

Prototipo 3D de fútbol con autos, construido con Three.js y servido por Vite.

## Estructura

- `src/`: interfaz, juego 3D, físicas, estilos y modelos GLB locales (`src/models/`).
- `package.json` y `package-lock.json`: dependencias y comandos npm.
- `vite.config.ts` y `tsconfig.json`: configuración de Vite y TypeScript.
- `dist/`: salida de producción generada al compilar.
- `Abrir Car Soccer.bat`: acceso rápido para Windows.

## Ejecutar en Windows

Desde esta carpeta, haz doble clic en `Abrir Car Soccer.bat`. También puedes ejecutar:

```powershell
npm install
npm run dev
```

Vite muestra la dirección que debes abrir en el navegador y mantiene el servidor activo en esa terminal.

## Requisitos

- Node.js 20.19 o posterior
- npm, incluido con Node.js
- Navegador moderno con WebGL

## Compilar

```powershell
npm run build
```

Los archivos de producción quedan en `dist/`.

## Controles

- `W A S D`: conducir (también admite las flechas)
- `Shift`: boost; se recarga al recoger pads de la cancha
- `Ctrl`: freno de mano / derrape
- `Espacio`: salto y doble salto/flip
- `Q` / `E`: giro aéreo a izquierda / derecha
- `C`: activar o desactivar Ball Cam
- `G`: abrir el garaje
- `M`: abrir el menú de partida
- `Esc` / `P` o `Start` en el mando: pausar o reanudar

En **Ajustes → Controles** puedes reasignar teclas y botones. En un mando, el stick izquierdo gira, RT acelera y LT da reversa; A salta, B impulsa y LB/RB sirven para los giros aéreos. En **Ajustes → Cámara** puedes cambiar distancia, altura, anticipación y fuerza de Ball Cam. La cámara mantiene el coche en el encuadre mientras sigue el balón.

## Cancha y garaje

La cancha usa las dimensiones estándar de Soccar de Rocket League: 102,4 × 81,92 m, techo a 20,44 m, porterías de 17,86 × 6,43 m y túneles de 8,8 m. Las esquinas y transiciones entre suelo, pared y techo son redondeadas. Hay 34 pads en las posiciones estándar del campo: seis grandes y 28 pequeños.

El garaje permite cambiar carrocería, pintura principal y secundaria, ruedas, accesorios 3D y boost. Incluye tres estilos visuales seleccionables: estándar, Alpha dorado y Dev cian. Los estilos de boost son cosméticos y no alteran las físicas. Las opciones y asignaciones se guardan en el navegador.

La escena incluye modelos GLB de Octane, Fennec y Dominus, además de los modelos locales de pads grandes y pequeños, césped texturizado, iluminación, sombras y bloom configurable. La física incluye inercia, tracción, freno de mano, movimiento aéreo, flips, colisiones, goles, kickoffs y pads de boost. El rival local anticipa la trayectoria, busca posiciones de tiro, protege su portería, recoge boost y salta para interceptar balones aéreos. Su dificultad se puede elegir antes del partido. El multijugador en línea todavía no está implementado.
