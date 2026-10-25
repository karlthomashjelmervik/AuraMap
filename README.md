# Aura Map Designer

A client-side GIS-style workspace for creating locations and analyzing overlapping aura fields. Projects are stored as local JSON files; no account or backend is required.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production bundle with `npm run build`, or preview it with `npm run preview`.

## Architecture

- `src/App.tsx` owns the project session, editor, location list and table, image/project file handling, and visualization controls.
- `src/MapCanvas.tsx` draws the map, raster aura overlay, contour lines, location markers, scale bar, and handles pan, zoom, add, and inspect interactions.
- `src/aura.ts` provides point sampling and a memoizable, downsampled aura grid calculation.
- `src/types.ts` defines locations, domains, visualization settings, grid data, and the JSON project schema.
- `src/styles.css` contains the responsive GIS workspace styling.

The component tree is `App` -> `MapCanvas` plus the editor, location layer, project toolbar, data table, and visualization toolbar. React state in `App` is the single source of truth; `useMemo` caches the aura grid until locations, map dimensions, R0, or meters-per-pixel change. Canvas rendering is kept separate from UI state and repaints on resize or relevant state changes.

## Aura model

For each non-Mundane source, contribution at a sample point is:

```text
contribution = strength / (((distanceMeters / R0) ** 2) + 1)
```

The contribution is added to its matching aura channel and subtracted from the other three channels. Point inspection reports all four signed channel values. A selected single-type overlay shows positive values for that type; Net Aura displays the largest absolute channel magnitude; Dominant Aura colors each pixel by its largest-magnitude channel. Values below the configured threshold are omitted from the raster overlay. Contours are drawn at 1, 3, 5, 7, and 10.

The render grid is downsampled to at most 420 by 300 samples regardless of source map dimensions, keeping calculation and drawing practical for 4000-by-4000 maps and large location sets. Map coordinates are stored in image pixels; the meters-per-pixel setting converts distances and displayed coordinates to meters.

## Project files

Save Project downloads a versioned JSON document containing the embedded map image (when imported), image dimensions and name, locations, and visualization settings. Open restores those values in the browser. Large raster images produce correspondingly large JSON files because the image is embedded as a data URL.