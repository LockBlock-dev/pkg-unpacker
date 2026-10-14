# pkg unpacker

Unpack **pkg**, **nexe**, **caxa**, **Node.js SEA** and **Bun** single-file binaries.

Keep in mind that **this tool doesn't give you the full source code if the application was compiled into bytecode** (pkg V8 bytecode, `sea` snapshots, `bun --bytecode` bundles). See [How it works](#how-it-works).

## Table of Contents

- [Support](#support)
- [Installation](#installation)
- [Usage](#usage)
    - [As a command line interface](#as-a-command-line-interface)
    - [As a library](#as-a-library)
- [Features](#features)
- [How it works](#how-it-works)
- [Copyright](#copyright)

## Support

As of this writing, **pkg-unpacker** supports the following tools:

| Tool                                                                      | Supported | Versions       | Comment                                                                                                            |
| ------------------------------------------------------------------------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| [vercel/pkg](https://github.com/vercel/pkg)                               | ✅        | 5.0.0 - 5.8.1  | N/A                                                                                                                |
| [yao-pkg/pkg](https://github.com/yao-pkg/pkg)                             | ✅        | 5.0.0 - 6.23.0 | Does not include experimental support for [Node SEA](https://nodejs.org/api/single-executable-applications.html) . |
| [AngaBlue/exe](https://github.com/AngaBlue/exe)                           | ❌        | -              | SEA-based output; should unpack via SeaUnpacker (no Windows sample to verify).                                     |
| [nexe/nexe](https://github.com/nexe/nexe)                                 | ✅        | 5.0.0-beta.4   | ZIP payload via sentinel footer; latest prebuilt base is Node 14.                                                  |
| [leafac/caxa](https://github.com/leafac/caxa)                             | ✅        | 3.0.1          | Self-extracting gzip-tar; Go-stub binaries (shell-stub variant unsupported).                                       |
| [bun compile](https://bun.sh/docs/bundler/executables)                    | ✅        | 1.4.3          | Layout may shift per release; `--bytecode` bundles not recoverable.                                               |
| [Node.js SEA](https://nodejs.org/api/single-executable-applications.html) | ✅        | Node 20+ blobs | Main script if stored as source, assets always.                                                                    |

### Format notes

-   **pkg**: trailer holds the virtual filesystem, entrypoint, symlinks,
    file dictionary and compression (`NONE`, `GZip`, `Brotli`, `Zstd`).
    Directories, symlinks and stat modes are restored. JavaScript comes out
    as V8 bytecode unless the binary was built with `--no-bytecode`.
-   **Node SEA**: blob holds the main script (**source**, unless
    `useSnapshot`) plus raw keyed assets. No modes or symlinks exist in the
    format. Snapshot mains are reported, not written.
-   **Bun**: file table with content-hashed names under `/$bunfs/`.
    Bundled JS comes out as source (or bytecode with `--bytecode`, which is
    reported, not written usefully). The table layout is Bun-internal and
    may shift per release.
-   **nexe**: ZIP payload located via the sentinel footer, plus the older
    JSON-manifest layout. Files come out as stored (usually source).
-   **caxa**: gzip-tar archive plus JSON footer. Files, dirs, symlinks and
    modes are restored. Only Go-stub binaries; the shell-stub (`.sh`)
    variant is a shell script around the same tarball.

## Installation

1. Install [Bun](https://bun.sh/).
2. Download or clone the project.
3. Navigate to the project directory.
4. Install the dependencies:
    ```sh
    bun install
    ```
5. (Optional) Verify the project:
    ```sh
    bun run typecheck
    bun test
    ```
6. (Optional) Build the project:
    ```sh
    bun run build
    ```
    Or compile to a single executable:
    ```sh
    bun run compile
    ```

Without cloning, add it from GitHub, then use the linked binary.

With Bun:

```sh
bun add github:LockBlock-dev/pkg-unpacker
./node_modules/.bin/pkg-unpacker -i ./pkg_app -o ./unpacked
```

Or in one shot:

```sh
bunx github:LockBlock-dev/pkg-unpacker -i ./pkg_app -o ./unpacked
```

With pnpm:

```sh
pnpm add github:LockBlock-dev/pkg-unpacker
./node_modules/.bin/pkg-unpacker -i ./pkg_app -o ./unpacked
```

Or in one shot:

```sh
pnpm dlx github:LockBlock-dev/pkg-unpacker -i ./pkg_app -o ./unpacked
```

With npm (git fetches need allowing):

```sh
NPM_CONFIG_ALLOW_GIT=all npm install github:LockBlock-dev/pkg-unpacker
./node_modules/.bin/pkg-unpacker -i ./pkg_app -o ./unpacked
```

## Usage

### As a command line interface

The binary format is auto-detected by default; pass `--format` to force one
(`pkg`, `sea`, `bun`, `nexe`, `caxa`).

To start the application with Bun, run:

```sh
bun run start -- -i ./pkg_app -o ./unpacked
```

Or run the source directly:

```sh
bun src/main.ts -i ./sea_app -o ./unpacked --format sea
```

### Node.js compatibility

The `src/` code (excluding tests, which are Bun-only via `bun:test`) also runs on Node.js. Relative imports use `.js` extensions so both runtimes resolve them.

```sh
npm run build:node   # or: bun run build:node  -> emits to dist-node/
node dist-node/main.js -i ./pkg_app -o ./unpacked
node dist-node/main.js -i ./bun_app -o ./unpacked --format bun
```

As a library on Node.js:

```js
import { createUnpacker } from "pkg-unpacker";
import PkgUnpacker from "pkg-unpacker/pkg/unpacker";
```

`--run` executes the entrypoint for **pkg** binaries on Node.js only: it
requires the host version to match the binary's target, otherwise it fails
with an explicit version error. Under Bun it is refused (V8 bytecode can't
run on JavaScriptCore), and for `sea`, `bun`, `nexe` and `caxa` binaries it
warns and unpacks without executing.

Here’s an overview of the `help` command output:

```console
Usage: pkg-unpacker [options]

Unpack pkg, nexe, caxa, Node.js SEA and Bun single-file binaries. The format is
auto-detected by default.

Options:
  -V, --version          output the version number
  -i, --input <file>     Specify the input binary file path
  -o, --output <folder>  Specify the output folder path (default: ".")
  --run                  Run the unpacked entrypoint (pkg binaries on Node.js
                         only) (default: false)
  --json                 Output the unpack result as JSON (default: false)
  --format <format>      Binary format to unpack (default: auto) (choices:
                         "pkg", "sea", "bun", "nexe", "caxa", "auto", default:
                         "auto")
  -h, --help             display help for command
```

#### Examples:

- Unpack a UNIX application (format auto-detected):

```console
$ bun run start -- -i ./pkg_app -o ./unpacked
```

- Unpack a Windows application:

```console
$ bun run start -- -i ./pkg_app.exe -o ./unpacked
```

- Unpack a Node.js SEA binary with an explicit format:

```console
$ bun src/main.ts -i ./sea_app -o ./unpacked --format sea
```

- Unpack a Bun binary on Node.js:

```console
$ node dist-node/main.js -i ./bun_app -o ./unpacked --format bun
```

- Unpack a UNIX application and run it (pkg on Node.js only):

```console
$ bun run start -- -i ./pkg_app -o ./unpacked --run
```

### As a library

The main logic of **pkg unpacker** lies in the [`PkgUnpacker`](./src/pkg/unpacker.ts)
class, with multi-format dispatch via [`createUnpacker`](./src/dispatch.ts),
re-exported from the package root ([`src/index.ts`](./src/index.ts)) so
`import "pkg-unpacker"` never runs the CLI.

#### Examples:

-   Unpack a UNIX application:

```ts
import PkgUnpacker from "pkg-unpacker/pkg/unpacker";

const main = async () => {
    const unpacker = await PkgUnpacker.create("./pkg_app");
    await unpacker.unpack("./unpacked");
};

main();
```

-   Unpack a Windows application and run it:

```ts
import PkgUnpacker from "pkg-unpacker/pkg/unpacker";

const main = async () => {
    const unpacker = await PkgUnpacker.create("./pkg_app.exe");
    await unpacker.unpack("./unpacked", true);
};

main();
```

-   Unpack any supported binary (auto-detected format):

```ts
import { createUnpacker } from "pkg-unpacker";

const main = async () => {
    const unpacker = await createUnpacker("./app.bin");
    await unpacker.unpack("./unpacked");
};

main();
```

-   Unpack a Node.js SEA binary with an explicit format:

```ts
import { createUnpacker } from "pkg-unpacker";

const main = async () => {
    const unpacker = await createUnpacker("./sea_app", "sea");
    await unpacker.unpack("./unpacked");
};

main();
```

-   Use a format-specific unpacker directly:

```ts
import SeaUnpacker from "pkg-unpacker/sea/unpacker";

const main = async () => {
    const unpacker = await SeaUnpacker.create("./sea_app");
    await unpacker.unpack("./unpacked");
};

main();
```

The `./dispatch` subpath (`pkg-unpacker/dispatch`) also exposes
`createUnpacker`/`detectFormat` directly. Per-format subpaths
(`pkg-unpacker/sea/unpacker`, `pkg-unpacker/bun/unpacker`,
`pkg-unpacker/nexe/unpacker`, `pkg-unpacker/caxa/unpacker`) expose each
unpacker class.

### With REA

Feed the output directory to [REA](https://github.com/morluto/rea) for analysis:

```sh
bun run start -- -i ./pkg_app -o ./unpacked --json > result.json
npx -y rea-agents@latest analyze-javascript-application /absolute/path/to/unpacked --json
```

## Features

- Auto-detects the binary format (`pkg`, `sea`, `bun`, `nexe`, `caxa`) or unpack a forced format with `--format`
- Detects compression formats (Gzip, Brotli, Zstd) in pkg binaries
- Supports code evaluation for pkg binaries on Node.js (`--run`)
- Handles symlinks and restores directories and stat modes where the format stores them
- Extracts binaries from all operating systems
- Runs on Bun and Node.js (via `dist-node/`)

## How it works

This application does not decompile code. By default, [pkg](https://github.com/vercel/pkg) compiles JavaScript into V8 bytecode. Extracted files will remain in this format, except for assets.

Code evaluation (`--run`) works best with small pkg applications as dependencies might be broken, and requires the host Node.js version to match the binary's target.

Each format stores its payload differently, see [Format notes](#format-notes) for the per-format layout:

-   **pkg** stores metadata about file names, paths, offsets, lengths, and compression at the end of each binary. This application analyzes those fields to extract and decompress (if necessary) all embedded files.
-   **Node.js SEA** embeds a blob with the main script and assets.
-   **Bun** embeds a file table with content-hashed names under `/$bunfs/`.
-   **nexe** embeds a ZIP payload located via the sentinel footer (plus an older JSON-manifest layout).
-   **caxa** embeds a self-extracting gzip-tar archive plus a JSON footer.

Examples:

```js
// UNIX app

{"/snapshot/pkg/index.js":{"0":[0,568],"3":[568,118]},"/snapshot/pkg":{"2":[686,12],"3":[698,117]},"/snapshot":{"2":[815,7],"3":[822,117]}} // virtual file system
,
"/snapshot/pkg/index.js" // entrypoint
,
{} // symlinks
,
{} // files dictionnary
,
0 // 0: no compression, 1: Gzip, 2: Brotli, 3: Zstd
```

```js
// Windows app

{"C:\\snapshot\\pkg\\index.js":{"0":[0,568],"3":[568,118]},"C:\\snapshot\\pkg":{"2":[686,12],"3":[698,117]},"C:\\snapshot":{"2":[815,7],"3":[822,117]}} // virtual file system
,
"C:\\snapshot\\pkg\\index.js" // entrypoint
,
{} // symlinks
,
{} // files dictionnary
,
0 // 0: no compression, 1: Gzip, 2: Brotli, 3: Zstd
```

## Copyright

See the [license](/LICENSE).
