# Icons Refresh Plan (2025-10-05)

- [x] Recreate icon assets with transparent backgrounds from `public/knurl.svg`.
- [x] Verify dimensions and alpha channel integrity.
- [x] Document the conversion commands used.

## Notes
- Icons are now generated via `scripts/generate-icons.mjs` using `@resvg/resvg-js` for accurate SVG rasterisation, then recomposed into ICO/ICNS.
- ImageMagick only handles format bundling; PNGs are emitted as `PNG32` without `bKGD`, leaving transparency intact.
- Verified edge pixels remain fully transparent (`srgba(0,0,0,0)`); `yarn lint` passes Tauri asset validation.
