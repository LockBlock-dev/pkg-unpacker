# pkg unpacker

Unpack any **pkg** application.

Keep in mind that **this tool doesn't give you the full source code if the application was compiled into V8 bytecode**. See [How it works](#how-it-works).

## Table of Contents

-   [Support](#support)
-   [Installation](#installation)
-   [Usage](#usage)
    -   [As a command line interface](#as-a-command-line-interface)
    -   [As a library](#as-a-library)
-   [Features](#features)
-   [How it works](#how-it-works)
-   [Credits](#credits)
-   [Copyright](#copyright)

## Support

As of this writing, **pkg-unpacker** supports the following tools:

| Tool                                            | Supported | Versions      | Comment                                                                                                            |
| ----------------------------------------------- | --------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| [vercel/pkg](https://github.com/vercel/pkg)     | ✅        | 5.0.0 - 5.8.1 | N/A                                                                                                                |
| [yao-pkg/pkg](https://github.com/yao-pkg/pkg)   | ✅        | 5.0.0 - 6.3.2 | Does not include experimental support for [Node SEA](https://nodejs.org/api/single-executable-applications.html) . |
| [AngaBlue/exe](https://github.com/AngaBlue/exe) | ❌        | -             | N/A                                                                                                                |

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

## Usage

### As a command line interface

To start the application, run:

```sh
bun run start -- -i ./pkg_app -o ./unpacked
```

Or run the source directly:

```sh
bun src/main.ts -i ./pkg_app -o ./unpacked
```

### Node.js compatibility

The `src/` code (excluding tests, which are Bun-only via `bun:test`) also runs on Node.js. Relative imports use `.js` extensions so both runtimes resolve them.

```sh
npm run build:node   # or: bun run build:node  -> emits to dist-node/
node dist-node/main.js -i ./pkg_app -o ./unpacked
```

As a library on Node.js:

```js
import Unpacker from "pkg-unpacker/unpacker";
```

Here’s an overview of the `help` command output:

```console
Usage: pkg-unpacker [options]

Options:
  -V, --version          output the version number
  -i, --input <file>     Specify the input binary file path
  -o, --output <folder>  Specify the output folder path (default: ".")
  --run                  Run the unpacked binary (default: false)
  -h, --help             display help for command
```

#### Examples:

-   Unpack a UNIX application:

```console
$ bun run start -- -i ./pkg_app -o ./unpacked
```

-   Unpack a Windows application:

```console
$ bun run start -- -i ./pkg_app.exe -o ./unpacked
```

-   Unpack a UNIX application and run it:

```console
$ bun run start -- -i ./pkg_app -o ./unpacked --run
```

### As a library

The main logic of **pkg unpacker** lies in the [`Unpacker`](./src/unpacker.ts) class.

#### Examples:

-   Unpack a UNIX application:

```ts
import Unpacker from "./src/unpacker.ts";

const main = async () => {
    const unpacker = await Unpacker.create("./pkg_app");
    await unpacker.unpack("./unpacked");
};

main();
```

-   Unpack a Windows application and run it:

```ts
import Unpacker from "./src/unpacker.ts";

const main = async () => {
    const unpacker = await Unpacker.create("./pkg_app.exe");
    await unpacker.unpack("./unpacked", true);
};

main();
```

## Features

-   Detects compression formats (Gzip, Brotli)
-   Supports code evaluation
-   Handles symlinks
-   Extracts binaries from all operating systems

## How it works

This application does not decompile code. By default, [pkg](https://github.com/vercel/pkg) compiles JavaScript into V8 bytecode. Extracted files will remain in this format, except for assets.

Code evaluation works best with small applications as dependencies might be broken.

[pkg](https://github.com/vercel/pkg) stores metadata about file names, paths, offsets, lengths, and compression at the end of each binary. This application analyzes those fields to extract and decompress (if necessary) all embedded files.

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
0 // 0: no compression, 1: Gzip, 2: Brotli
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
0 // 0: no compression, 1: Gzip, 2: Brotli
```

## Credits

[pkg](https://github.com/vercel/pkg)

## Copyright

See the [license](/LICENSE).
