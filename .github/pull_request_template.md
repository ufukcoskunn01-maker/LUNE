## Summary

- What changed:
- Why:

## Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run guard:no-direct-upload`

## Risks / Rollback

- Risks:
- Rollback plan:

## Checklist

- [ ] No secrets committed (`.env`, API keys, credentials)
- [ ] Migrations included when schema changes
- [ ] Direct `storage.upload` not used outside `src/features/files/uploadFile.ts`
