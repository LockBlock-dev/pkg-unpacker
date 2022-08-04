# pkg unpacker

Unpack any [pkg](https://github.com/vercel/pkg) application.

Keep in mind that <span style="color:red">this doesn't give you the full source code if the application was compiled into V8 bytecode</span>. See [How it works](#how-it-works).

This should work with any pkg application, but errors may occur.

This app may broke at any pkg major update.

## Installation

-   Install [NodeJS](https://nodejs.org).
-   Download or clone the project.
-   Go to the `pkg-unpacker` folder and run `npm install`.

## Usage

```console
node unpack.js [options]

  Options:

    -i        input file name / path to the input file
    -o        output file name / path to the output file
    --run     try to run the entrypoint of the app

  Examples:

  – Unpack an UNIX app
    $ node unpack.js -i ./pkg_app -o ./unpacked
  – Unpack a Windows app
    $ node unpack.js -i ./pkg_app.exe -o ./unpacked
  – Unpack an UNIX app and run it
    $ node unpack.js -i ./pkg_app -o ./unpacked --run
```

## Features

-   Compression detection (Gzip, Brotli)
-   Code evaluation
-   Symlink handling
-   Unpack binaries of all operating systems

## How it works

This application **DOES NOT** decompile any code. By default [pkg](https://github.com/vercel/pkg) compiles code to V8 bytecode. Extracted files will remain in this format except for assets.

Code evaluation works best with small applications. Requirements can be broken.

[pkg](https://github.com/vercel/pkg) writes the file name, path, offset, length and compression at the bottom of each binary. This application analyzes these fields, then extracts and decompresses (if compressed) all the files of the binary.

Examples:

```js
//UNIX app

{"/snapshot/pkg/index.js":{"0":[0,568],"3":[568,118]},"/snapshot/pkg":{"2":[686,12],"3":[698,117]},"/snapshot":{"2":[815,7],"3":[822,117]}} //virtual file system
,
"/snapshot/pkg/index.js" //entrypoint
,
{} //symlinks
,
{} //files dictionnary
,
0 //0: no compression, 1: Gzip, 2: Brotli
```

```js
//Windows app

{"C:\\snapshot\\pkg\\index.js":{"0":[0,568],"3":[568,118]},"C:\\snapshot\\pkg":{"2":[686,12],"3":[698,117]},"C:\\snapshot":{"2":[815,7],"3":[822,117]}} //virtual file system
,
"C:\\snapshot\\pkg\\index.js" //entrypoint
,
{} //symlinks
,
{} //files dictionnary
,
0 //0: no compression, 1: Gzip, 2: Brotli
```

## Credits

[pkg](https://github.com/vercel/pkg)

## Copyright

See the [license](/LICENSE).
