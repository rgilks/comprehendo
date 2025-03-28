# Dependency Migration Plan

This document tracks the migration of Comprehend to newer versions of its core dependencies.

## Initial State (March 28, 2025)

- Next.js: 14.2.26
- React/React DOM: 18.2.0
- Tailwind CSS: 3.4.1
- next-auth: 4.24.11

## Current State (March 28, 2025)

- Next.js: 14.2.26
- React/React DOM: 19.0.0 ✅
- Tailwind CSS: 3.4.1
- next-auth: 4.24.11

## Migration Phases

### Phase 1: Documentation & Backup ✅

- [x] Create this migration documentation
- [x] Ensure code is committed to Git
- [x] Create a backup branch: `git checkout -b pre-migration-backup`

### Phase 2: Update Tailwind CSS to v4 ❌

- [x] Read Tailwind CSS v4 migration guide: https://tailwindcss.com/docs/upgrading-to-v4
- [x] Install dependencies: `npm install tailwindcss@latest @tailwindcss/postcss`
- [x] Update PostCSS config:

```js
// postcss.config.js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
```

- [x] Update Tailwind config:

```js
// tailwind.config.js
export default {
  // ...config
};
```

- [x] Test all UI components
  - **ISSUE**: UI styling is completely lost after upgrading to Tailwind CSS v4
  - **RESOLUTION**: Reverted back to Tailwind CSS v3.4.1 for now

### Phase 3: Update React to v19 ✅

- [x] Read React 19 release notes: https://react.dev/blog/2024/02/22/react-labs-what-we-have-been-working-on
- [x] Install React 19: `npm install react@latest react-dom@latest`
- [x] Test for strict mode compatibility
  - **RESULT**: Application works correctly with React 19 despite peer dependency warnings
- [x] Fix any deprecated API usage
  - **RESULT**: No changes needed, codebase is already compatible with React 19

### Phase 4: Update Next.js to v15 🔄

- [ ] Read Next.js 15 migration guide: https://nextjs.org/docs/app/building-your-application/upgrading/version-15
- [ ] Update Next.js: `npm install next@latest`
- [ ] Remove deprecated options from next.config.js
- [ ] Test API routes
- [ ] Run build and deployment tests

### Phase 5: Update next-auth (if needed)

- [ ] Check for compatibility with Next.js 15
- [ ] Update if necessary: `npm install next-auth@latest`

## Issues Encountered

| Date       | Issue                                                   | Solution                                            |
| ---------- | ------------------------------------------------------- | --------------------------------------------------- |
| 2025-03-28 | Tailwind CSS v4 upgrade broke all styling               | Reverted to Tailwind CSS v3.4.1                     |
| 2025-03-28 | React 19 shows peer dependency warnings with Next.js 14 | Warnings can be safely ignored; app works correctly |

## Testing Checklist

- [x] Authentication flows (tested with React 19)
- [x] API routes (tested with React 19)
- [x] Page navigation (tested with React 19)
- [x] UI components (tested with React 19)
- [ ] Build process
- [ ] Deployment
