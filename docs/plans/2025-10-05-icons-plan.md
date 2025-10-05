# Icons Refresh Plan (2025-10-05)

- [x] Recreate icon assets with transparent backgrounds from `public/knurl.svg`.
- [x] Verify dimensions and alpha channel integrity.
- [x] Document the conversion commands used.

## Notes
- Regenerated PNGs via ImageMagick with ~12% padding, `PNG32` output, and `-strip` to drop `bKGD` chunks so viewers respect transparency.
- Rebuilt ICO and ICNS bundles from the same transparent PNG set for platform parity.
- Verified edge pixels remain fully transparent (`srgba(0,0,0,0)`); `yarn lint` passes Tauri asset validation.
