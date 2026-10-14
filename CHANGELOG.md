# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-10-14

### Changed

-   CLI is multi-format throughout: program description, `--format` help (`Binary format to unpack (default: auto-detect)`) and `--run` help (`pkg binaries on Node.js only`); the pkg-specific `--run`-under-Bun guard now lives in `PkgUnpacker` so `sea`/`bun`/`nexe`/`caxa` unpack with a warning instead of a hard CLI failure
-   `src/main.ts` shebang is `#!/usr/bin/env node` so the `dist-node/main.js` entrypoint runs directly under Node.js; `bun src/main.ts` keeps working
-   README covers all formats (CLI `--format` examples, Bun and Node.js entrypoints, per-format library examples) and drops the `## Credits` section; the `pkg-unpacker` name is kept for legacy

## [3.0.0] - 2026-10-14

### Added

-   `NexeUnpacker`: unpack nexe binaries (ZIP payload, old JSON-manifest layout included)
-   `CaxaUnpacker`: unpack caxa self-extracting gzip-tar binaries
-   `SeaUnpacker`: unpack Node.js single-executable binaries (source mains, raw assets, snapshot mains reported unrecoverable)
-   `BunUnpacker`: unpack Bun single-file executables (bundled source, raw assets, bytecode bundles reported unrecoverable)
-   Multi-format architecture: `FormatUnpacker` interface, format detection and dispatcher, `--format` flag

### Changed

-   **Breaking:** `Unpacker` is now `PkgUnpacker` and lives in `src/pkg/unpacker.ts`; use `createUnpacker` for multi-format binaries
-   **Breaking:** the package root now exports the library (`src/index.ts` re-exporting the dispatcher) instead of the CLI runner; the `pkg-unpacker` bin still runs the CLI. New subpaths: `./dispatch`, `./sea/unpacker`, `./bun/unpacker`, `./nexe/unpacker`, `./caxa/unpacker`
-   Shared unpack helpers (`createResultCollector`, `createOutputWriter`, `writeSymlinkOut`, `applyMode`, `stripPrefix`, `ensureDir`, `isOutside`) replace the per-format `warn` closures, inline outside-checks, inline `mkdir`s and `stripName` variants
-   Test fixtures live in `tests/helpers.ts` so `dist-node/` no longer ships `src/*/fixtures.js`

### Fixed

-   Mask caxa tar modes with `0o777` at parse time so crafted binaries cannot set setuid/setgid/sticky bits via `chmod`
-   Skip `chmod` for files that were not written (outside output directory or duplicate path) in nexe/caxa unpackers

## [2.8.0] - 2026-10-13

### Added

-   `bin` entry with Bun shebang: run via `./node_modules/.bin/pkg-unpacker` or `bunx` after a GitHub install

## [2.7.0] - 2026-10-13

### Added

-   `unpack()` returns a result object (files, skipped, symlinks, warnings) and `--json` prints it on stdout
-   Classify extracted files as bytecode, source or asset
-   Strip the snapshot root from output paths; reject paths escaping the output directory

## [2.6.0] - 2026-10-13

### Added

-   Recreate directories and symlinks and apply stat modes on extraction

### Changed

-   Unpack files in parallel chunks and cache created directories
-   `--run` is refused under Bun and requires a matching Node.js/V8 version otherwise, with an explicit error

## [2.5.0] - 2026-10-13

### Added

-   Support Zstd compression (yao-pkg/pkg) end to end: enum value, decompression, placeholder discovery, tests

### Fixed

-   Reject `payloadPosition <= 0` with a loud error instead of silently extracting garbage
-   Reject unknown compression types instead of writing nonsense files

### Changed

-   `Unpacker.create` falls back to placeholder discovery (padded-number scan validated against stat entries) when the payload marker is unpatched, restoring newer yao-pkg binaries
-   Props regex captures any compression digit so unknown ones reach validation instead of being silently truncated

## [2.4.0] - 2026-10-13

### Fixed

-   Close the file handle in `unpack` (`try/finally`) instead of leaking it
-   Await the CLI run in `main.ts` and exit non-zero on failure instead of an unhandled rejection
-   Keep unknown path segments as-is in `toOriginal` instead of joining `undefined`
-   Debug-log decompression fallback in `readFile` instead of swallowing the error

### Changed

-   `Unpacker.create` scans the binary tail (doubling 4 MiB window) for props and the payload marker instead of reading the whole file twice
-   Remove dead `Buffer`/`URL` branches (`isUrl`/`pathToString`), fix `nativeSeparator` typo
-   Add `-V, --version` flag wired to the package version

## [2.3.0] - 2026-10-13

### Added

-   Node.js compatibility for `src/` (tests stay Bun-only): `tsconfig.node.json` (`NodeNext` emit to `dist-node/`, tests excluded), `build:node` / `start:node` / `typecheck:node` scripts, `main`/`exports` fields, explicit `@types/node` dev dependency
-   Use `.js` extensions in relative imports so both Bun and Node ESM resolve them

## [2.2.0] - 2026-10-13

### Changed

-   Migrate runtime and toolchain from Node.js/npm to Bun
-   Bump `commander` from `^13.1.0` to `^15.0.0` and `typescript` from `^5.8.2` to `^7.0.2`, replace `@types/node` with `@types/bun`
-   Update `tsconfig.json` to the Bun recommended setup (`Preserve`/`bundler`, stricter checks)
-   Migrate tests from `node:test` to `bun:test`
-   Fix strict type errors revealed by TypeScript 7 (`noUncheckedIndexedAccess`)
-   Update install/usage docs to Bun

## [2.1.1] - 2025-05-30

### Added

-   Some basic tests

### Fixed

-   Regression in path handling introduced in [`2.1.0`](#210---2025-03-08)

## [2.1.0] - 2025-03-08

### Added

-   Support for pkg 5.2.0 (using $ separators)
-   Support for pkg >= 5.0.0 and < 5.2.0

## [2.0.1] - 2025-03-08

### Added

-   Compression type and entrypoint logs
-   Supported tools in README

### Changed

-   Changed StoreType to reflect vercel/pkg names

### Fixed

-   Unpacker.readFile return when no compression is detected

## [2.0.0] - 2025-03-08

### Changed

-   TypeScript rewrite

## [1.0.2] - 2022-11-28

### Changed

-   Regex refactoring (#2)

## [1.0.1] - 2022-11-28

### Changed

-   Improve speed and use text content by default (#1)

## [1.0.0] - 2022-08-04

### Added

-   Initial release
