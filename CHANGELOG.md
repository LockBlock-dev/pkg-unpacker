# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
