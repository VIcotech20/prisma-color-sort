# PRISMA

Color-sort premium. Vierte el pigmento, sella el frasco.

Juego hybrid-casual de ordenar colores en tubos de vidrio: arrastra, mantén la racha, completa el espectro. 200 niveles, desafío diario y tubos Eclipse.

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:8080](http://localhost:8080).

Build de producción:

```bash
npm run build
npm run preview
```

Opcional: Game ID de GameDistribution en `VITE_GD_GAME_ID` o `?gdGameId=EL_ID`.

## Stack

- React 19 + TypeScript
- Vite + TanStack Start
- Tailwind CSS v4
- Zustand (progreso en `localStorage`)
- CrazyGames SDK (interstitial en Siguiente, rewarded en ayudas)
- GameDistribution SDK (listo, falta Game ID)

## Estado y pendientes

Listo para subir a CrazyGames. Falta:

- [ ] Cuenta en CrazyGames → Developers → Submit HTML5
- [ ] Game ID de GameDistribution (`VITE_GD_GAME_ID`)
- [ ] Subir icono (`public/icon-512.png`) y capturas (`public/listing/`)
- [ ] Página de privacidad en `/privacidad` (ya está en el juego; hay que pegar la URL pública en el formulario del portal)

Listing (copy + capturas + icono): `public/listing/`.
