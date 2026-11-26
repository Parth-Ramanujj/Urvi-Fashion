# Project: clothing

## Commands
- Build: `next build`
- Test: `[fill in]`
- Lint: `[fill in]`
- Dev: `next dev`

## Stack
Node.js / Next.js

## Entry Points
- app/layout.tsx

## Optimization Rules
- Use Server Components by default — only add "use client" when needed (event handlers, hooks, browser APIs)
- Prefer Server Actions over API routes for mutations
- Use `next/image` for all images — never raw `<img>`
- Use `next/link` for navigation — never raw `<a>` for internal links
- Colocate data fetching in Server Components — avoid client-side fetch for initial data
- Use `loading.tsx` and `error.tsx` for route-level loading/error states

## Key Decisions
- [fill in: Why X not Y → reason]

## Things That Look Wrong But Aren't
- [fill in: file/pattern → why it's intentional]

## Conventions
- [fill in your naming convention]
- [fill in your file organization rule]

## Workflow
- New feature → /plan first, then /smart-edit to implement
- Bug fix → /debug-error or /fix-issue [number]
- Before editing unfamiliar code → /explore-area [dir]
- After all changes → /review then /commit
- Ready to merge → /create-pr
- New developer → /onboard
