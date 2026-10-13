import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { CompressionType, type Props } from "./types.js";
import Unpacker from "./unpacker.js";
import { zstdDecompress, parseStatMode } from "./utils.js";

describe("pkg 5.8.1 (latest) - linux", () => {
    const prelude: Props = {
        vfs: {
            "/snapshot/pkg/index.js": { "0": [0, 560], "3": [560, 118] },
            "/snapshot/pkg": { "2": [678, 12], "3": [690, 117] },
            "/snapshot": { "2": [807, 7], "3": [814, 117] },
        },
        entryPoint: "/snapshot/pkg/index.js",
        symlinks: {},
        filesDict: {},
        doCompress: CompressionType.NONE,
    };

    test("can find VFS entry", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const vfsEntry = unpacker["findVirtualFileSystemEntry"](
            prelude.entryPoint,
        );

        expect(vfsEntry).toEqual(prelude.vfs[prelude.entryPoint]);
    });
});

describe("pkg 5.8.1 (latest) - linux - gzip", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 363], "3": [363, 99] },
            "0/1/2": { "2": [462, 32], "3": [494, 100] },
            "0/1": { "2": [594, 27], "3": [621, 100] },
        },
        entryPoint: "/snapshot/pkg/index.js",
        symlinks: {},
        filesDict: { "": "0", snapshot: "1", pkg: "2", "index.js": "3" },
        doCompress: CompressionType.GZIP,
    };

    test("can uncompress path", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0/1/2/3";
        const uncompressedPath = unpacker["toOriginal"](compressedPath);
        const expectedPath = prelude.entryPoint;

        expect(uncompressedPath).toBe(expectedPath);
    });

    test("can find VFS entry", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0/1/2/3";
        const vfsEntry = unpacker["findVirtualFileSystemEntry"](
            unpacker["toOriginal"](compressedPath),
        );

        expect(vfsEntry).toEqual(prelude.vfs[compressedPath]);
    });
});

describe("pkg 5.2.0 - linux - gzip", () => {
    const prelude: Props = {
        vfs: {
            "0$1$2$3": { "0": [0, 383], "1": [383, 51], "3": [434, 99] },
            "0$1$2": { "2": [533, 32], "3": [565, 100] },
            "0$1": { "2": [665, 34], "3": [699, 100] },
        },
        entryPoint: "/snapshot/vercel_pkg/index.js",
        symlinks: {},
        filesDict: { "": "0", snapshot: "1", vercel_pkg: "2", "index.js": "3" },
        doCompress: CompressionType.GZIP,
    };

    test("can uncompress path", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0$1$2$3";
        const uncompressedPath = unpacker["toOriginal"](compressedPath);
        const expectedPath = prelude.entryPoint;

        expect(uncompressedPath).toBe(expectedPath);
    });

    test("can find VFS entry", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0$1$2$3";
        const vfsEntry = unpacker["findVirtualFileSystemEntry"](
            unpacker["toOriginal"](compressedPath),
        );

        expect(vfsEntry).toEqual(prelude.vfs[compressedPath]);
    });
});

describe("pkg 5.8.1 (latest) - windows", () => {
    const prelude: Props = {
        vfs: {
            "C:\\snapshot\\pkg\\index.js": { "0": [0, 560], "3": [560, 118] },
            "C:\\snapshot\\pkg": { "2": [678, 12], "3": [690, 117] },
            "C:\\snapshot": { "2": [807, 7], "3": [814, 117] },
        },
        entryPoint: "C:\\snapshot\\pkg\\index.js",
        symlinks: {},
        filesDict: {},
        doCompress: CompressionType.NONE,
    };

    test("can find VFS entry", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const vfsEntry = unpacker["findVirtualFileSystemEntry"](
            prelude.entryPoint,
        );

        expect(vfsEntry).toEqual(prelude.vfs[prelude.entryPoint]);
    });
});

describe("pkg 5.8.1 (latest) - windows - gzip", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 362], "3": [362, 99] },
            "0/1/2": { "2": [461, 32], "3": [493, 100] },
            "0/1": { "2": [593, 27], "3": [620, 100] },
        },
        entryPoint: "C:\\snapshot\\pkg\\index.js",
        symlinks: {},
        filesDict: { "C:": "0", snapshot: "1", pkg: "2", "index.js": "3" },
        doCompress: CompressionType.GZIP,
    };

    test("can uncompress path", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0/1/2/3";
        const uncompressedPath = unpacker["toOriginal"](compressedPath);
        const expectedPath = prelude.entryPoint;

        expect(uncompressedPath).toBe(expectedPath);
    });

    test("can find VFS entry", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0/1/2/3";
        const vfsEntry = unpacker["findVirtualFileSystemEntry"](
            unpacker["toOriginal"](compressedPath),
        );

        expect(vfsEntry).toEqual(prelude.vfs[compressedPath]);
    });
});

describe("pkg 6.23.0 - linux - zstd", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 418], "3": [418, 95] },
            "0/1/2": { "2": [513, 21], "3": [534, 98] },
            "0/1": { "2": [632, 16], "3": [648, 98] },
        },
        entryPoint: "/snapshot/app/index.js",
        symlinks: {},
        filesDict: { "": "0", snapshot: "1", app: "2", "index.js": "3" },
        doCompress: CompressionType.ZSTD,
    };

    test("can uncompress path", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0/1/2/3";
        const uncompressedPath = unpacker["toOriginal"](compressedPath);
        const expectedPath = prelude.entryPoint;

        expect(uncompressedPath).toBe(expectedPath);
    });

    test("can find VFS entry", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        const compressedPath = "0/1/2/3";
        const vfsEntry = unpacker["findVirtualFileSystemEntry"](
            unpacker["toOriginal"](compressedPath),
        );

        expect(vfsEntry).toEqual(prelude.vfs[compressedPath]);
    });

    test("can decompress zstd", async () => {
        const blob = Buffer.from(
            "KLUv/SArWQEAeyJtb2RlIjozMzE4OCwic2l6ZSI6MjgsImlzRmlsZVZhbHVlIjp0cnVlfQ==",
            "base64",
        );

        const decompressed = await zstdDecompress(blob);

        expect(decompressed.toString("utf-8")).toBe(
            '{"mode":33188,"size":28,"isFileValue":true}',
        );
    });
});

describe("parseStatMode", () => {
    test("extracts permission bits", () => {
        expect(parseStatMode(Buffer.from('{"mode":33188}'))).toBe(0o644);
        expect(parseStatMode(Buffer.from('{"mode":16877}'))).toBe(0o755);
    });

    test("rejects garbage", () => {
        expect(parseStatMode(Buffer.from("not json"))).toBeUndefined();
        expect(parseStatMode(Buffer.from('{"size":3}'))).toBeUndefined();
    });
});

describe("symlinks", () => {
    const prelude: Props = {
        vfs: { "/snapshot/a": { "0": [0, 1] } },
        entryPoint: "/snapshot/a",
        symlinks: { "/snapshot/link": "/snapshot/a" },
        filesDict: {},
        doCompress: CompressionType.NONE,
    };

    test("precomputes link map", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        expect(unpacker["symlinkLinks"].get("/snapshot/link")).toBe(
            "/snapshot/a",
        );
    });

    test("remaps snapshot targets into output", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        expect(unpacker["remapSymlinkTarget"]("/snapshot/a", "/out")).toBe(
            path.join("/out", "/snapshot/a"),
        );
        expect(unpacker["remapSymlinkTarget"]("../rel", "/out")).toBe(
            "../rel",
        );
        expect(unpacker["remapSymlinkTarget"]("/etc/hostname", "/out")).toBe(
            "/etc/hostname",
        );
    });
});

describe("unpack fidelity", () => {
    const buildBinary = () => {
        const appContent = "console.log(1);";
        const statFile = '{"mode":33188}';
        const children = '["app.js"]';
        const statDir = '{"mode":16877}';
        const statLink = '{"mode":33188}';

        const appOff = 0;
        const statFileOff = appOff + appContent.length;
        const childrenOff = statFileOff + statFile.length;
        const statDirOff = childrenOff + children.length;
        const statLinkOff = statDirOff + statDir.length;

        const vfs = {
            "/snapshot/app.js": {
                "0": [appOff, appContent.length],
                "3": [statFileOff, statFile.length],
            },
            "/snapshot/sub": {
                "2": [childrenOff, children.length],
                "3": [statDirOff, statDir.length],
            },
            "/snapshot/link": { "3": [statLinkOff, statLink.length] },
        };

        const trailer = [
            JSON.stringify(vfs),
            JSON.stringify("/snapshot/app.js"),
            JSON.stringify({ "/snapshot/link": "/snapshot/app.js" }),
            "{}",
            "0",
        ].join("\n,\n");

        const header = "JUNKJUNK\n";
        const position = header.length + 24 + 12 + 7;
        const markerLine =
            `var PAYLOAD_POSITION = '${String(position).padStart(12, " ")}' | 0;\n`;
        const payload =
            appContent + statFile + children + statDir + statLink;

        return Buffer.concat([
            Buffer.from(header + markerLine),
            Buffer.from(payload),
            Buffer.from("\n"),
            Buffer.from(trailer),
        ]);
    };

    test("extracts files, dirs, modes and symlinks", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake.bin");
        const out = path.join(dir, "out");

        await fs.writeFile(bin, buildBinary());

        const unpacker = await Unpacker.create(bin);
        await unpacker.unpack(out);

        const appPath = path.join(out, "snapshot", "app.js");
        expect(await fs.readFile(appPath, "utf-8")).toBe("console.log(1);");
        expect((await fs.stat(appPath)).mode & 0o777).toBe(0o644);

        const subPath = path.join(out, "snapshot", "sub");
        expect((await fs.stat(subPath)).isDirectory()).toBe(true);
        expect((await fs.stat(subPath)).mode & 0o777).toBe(0o755);

        const linkPath = path.join(out, "snapshot", "link");
        expect((await fs.lstat(linkPath)).isSymbolicLink()).toBe(true);
        expect(await fs.readlink(linkPath)).toBe(appPath);
        expect(await fs.readFile(linkPath, "utf-8")).toBe("console.log(1);");

        await fs.rm(dir, { recursive: true });
    });
});

describe("--run", () => {
    test("unpack refuses --run under Bun", async () => {
        const unpacker = new Unpacker("N/A", {
            vfs: {},
            entryPoint: "",
            symlinks: {},
            filesDict: {},
            doCompress: CompressionType.NONE,
        }, -1);

        await expect(unpacker.unpack("/nonexistent-dir", true)).rejects.toThrow(
            /not supported under Bun/,
        );
    });
});
