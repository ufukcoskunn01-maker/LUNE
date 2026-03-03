# LUNE Operations Modules (2026-02-28)

## New/Updated Routes

- `/warehouse` -> 1C Warehouse Follow-Up dashboard
- `/documents` -> Project Documents Follow-Up dashboard
- `/project-controls` -> Integrated Project Controls Follow-Up dashboard
- `/cable-calculations` -> Cable Calculations operations dashboard

## Scope

- All modules are implemented inside the LUNE app codebase:
  `C:\Users\ufukc\OneDrive\Belgeler\project-controls\project-controls`
- Warehouse and documents include 1C/external sync fields in operational rows.
- Project controls ties package execution risk to material/document readiness.
- Cable calculations includes derived ampacity and voltage-drop checks.

## Manual Test Steps

1. Run `npm run dev` in LUNE.
2. Open and verify each page:
   - `/warehouse`
   - `/documents`
   - `/project-controls`
   - `/cable-calculations`
3. On each page, test:
   - filters + search
   - status toggles
   - sort behavior in table headers
   - detail drawer opening
   - CSV export action
4. Validate alerts panel shows actionable items.
5. Confirm navigation has entries for:
   - Project Controls
   - Warehouse Follow-Up
   - Cable Calculations
   - Project Documents
