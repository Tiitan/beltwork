# Beltwork Style Guide

## Purpose

- Keep code predictable and easy to review.
- Prefer mechanical rules that can be linted/formatted.

## JavaScript Script Style (`scripts/*.mjs`)

- Use Node ESM imports.
- Prefer early validation and explicit error messages.
- Keep function calls on one line when readable.
- Keep `throw new Error(...)` on one line when readable.
- Break lines only when readability clearly improves or line length becomes excessive.

## Formatting and Linting

- Formatting: `prettier` (repo-wide).
- Linting for scripts: `npm run lint:scripts`.
- Full lint gate: `npm run lint`.

## Command Usage

- Format all files: `npm run format`
- Check formatting: `npm run format:check`
- Lint scripts only: `npm run lint:scripts`
- Full lint pipeline: `npm run lint`
