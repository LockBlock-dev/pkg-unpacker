import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
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
            path.join("/out", "a"),
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
        const evilContent = "evil";

        const appOff = 0;
        const statFileOff = appOff + appContent.length;
        const childrenOff = statFileOff + statFile.length;
        const statDirOff = childrenOff + children.length;
        const statLinkOff = statDirOff + statDir.length;
        const evilOff = statLinkOff + statLink.length;

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
            "../../evil-pkg-unpacker-test": {
                "0": [evilOff, evilContent.length],
            },
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
            appContent + statFile + children + statDir + statLink + evilContent;

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
        const result = await unpacker.unpack(out);

        const appPath = path.join(out, "app.js");
        const subPath = path.join(out, "sub");
        const linkPath = path.join(out, "link");
        const evilOutside = path.join(tmpdir(), "evil-pkg-unpacker-test");

        expect(result.outputDir).toBe(out);
        expect(result.entrypoint).toBe("/snapshot/app.js");
        expect(result.compression).toBe("NONE");
        expect(result.files).toEqual([
            { path: appPath, size: 15, kind: "bytecode" },
        ]);
        expect(result.skipped).toEqual([
            { path: evilOutside, reason: "outside output directory" },
        ]);
        expect(result.symlinks).toEqual([
            { path: linkPath, target: appPath },
        ]);
        expect(result.warnings).toEqual([]);

        expect(await fs.readFile(appPath, "utf-8")).toBe("console.log(1);");
        expect((await fs.stat(appPath)).mode & 0o777).toBe(0o644);

        expect((await fs.stat(subPath)).isDirectory()).toBe(true);
        expect((await fs.stat(subPath)).mode & 0o777).toBe(0o755);

        expect((await fs.lstat(linkPath)).isSymbolicLink()).toBe(true);
        expect(await fs.readlink(linkPath)).toBe(appPath);
        expect(await fs.readFile(linkPath, "utf-8")).toBe("console.log(1);");
        expect(existsSync(evilOutside)).toBe(false);

        await fs.rm(dir, { recursive: true });
        await fs.rm(evilOutside, { force: true });
    });
});

describe("yao-pkg 6.3.2 - linux", () => {
    const prelude: Props = {
        vfs: {
            "/snapshot/app/index.js": { "0": [0, 560], "3": [560, 118] },
            "/snapshot/app": { "2": [678, 12], "3": [690, 117] },
            "/snapshot": { "2": [807, 7], "3": [814, 117] },
        },
        entryPoint: "/snapshot/app/index.js",
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

describe("yao-pkg 6.3.2 - linux - gzip", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 364], "3": [364, 99] },
            "0/1/2": { "2": [463, 32], "3": [495, 100] },
            "0/1": { "2": [595, 27], "3": [622, 100] },
        },
        entryPoint: "/snapshot/app/index.js",
        symlinks: {},
        filesDict: { "": "0", snapshot: "1", app: "2", "index.js": "3" },
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

describe("pkg 5.8.1 (latest) - linux - brotli", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 322], "3": [322, 87] },
            "0/1/2": { "2": [409, 16], "3": [425, 91] },
            "0/1": { "2": [516, 11], "3": [527, 91] },
        },
        entryPoint: "/snapshot/app/index.js",
        symlinks: {},
        filesDict: { "": "0", snapshot: "1", app: "2", "index.js": "3" },
        doCompress: CompressionType.BROTLI,
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

describe("yao-pkg 6.23.0 (latest) - linux", () => {
    const prelude: Props = {
        vfs: {
            "/snapshot/app/index.js": { "0": [0, 616], "3": [616, 118] },
            "/snapshot/app": { "2": [734, 12], "3": [746, 117] },
            "/snapshot": { "2": [863, 7], "3": [870, 117] },
        },
        entryPoint: "/snapshot/app/index.js",
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

describe("yao-pkg 6.23.0 (latest) - linux - gzip", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 385], "3": [385, 99] },
            "0/1/2": { "2": [484, 32], "3": [516, 100] },
            "0/1": { "2": [616, 27], "3": [643, 100] },
        },
        entryPoint: "/snapshot/app/index.js",
        symlinks: {},
        filesDict: { "": "0", snapshot: "1", app: "2", "index.js": "3" },
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

describe("yao-pkg 6.23.0 (latest) - linux - brotli", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 350], "3": [350, 87] },
            "0/1/2": { "2": [437, 16], "3": [453, 91] },
            "0/1": { "2": [544, 11], "3": [555, 91] },
        },
        entryPoint: "/snapshot/app/index.js",
        symlinks: {},
        filesDict: { "": "0", snapshot: "1", app: "2", "index.js": "3" },
        doCompress: CompressionType.BROTLI,
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

describe("yao-pkg 6.23.0 (latest) - windows - gzip", () => {
    const prelude: Props = {
        vfs: {
            "0/1/2/3": { "0": [0, 384], "3": [384, 99] },
            "0/1/2": { "2": [483, 32], "3": [515, 100] },
            "0/1": { "2": [615, 27], "3": [642, 100] },
        },
        entryPoint: "C:\\snapshot\\app\\index.js",
        symlinks: {},
        filesDict: { "C:": "0", snapshot: "1", app: "2", "index.js": "3" },
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

describe("classifyKind", () => {
    test("labels by store and extension", () => {
        expect(Unpacker["classifyKind"](false, ".js")).toBe("bytecode");
        expect(Unpacker["classifyKind"](true, ".js")).toBe("source");
        expect(Unpacker["classifyKind"](false, ".mjs")).toBe("bytecode");
        expect(Unpacker["classifyKind"](true, ".png")).toBe("asset");
        expect(Unpacker["classifyKind"](false, ".png")).toBe("asset");
        expect(Unpacker["classifyKind"](false, ".json")).toBe("source");
    });
});

describe("toOutPath", () => {
    const prelude: Props = {
        vfs: {},
        entryPoint: "/snapshot/app.js",
        symlinks: {},
        filesDict: {},
        doCompress: CompressionType.NONE,
    };

    test("strips the snapshot root", () => {
        const unpacker = new Unpacker("N/A", prelude, -1);

        expect(unpacker["toOutPath"]("/snapshot/app/index.js", "/out")).toBe(
            path.join("/out", "app", "index.js"),
        );
        expect(unpacker["toOutPath"]("/etc/hostname", "/out")).toBe(
            path.join("/out", "etc", "hostname"),
        );
    });

    test("normalizes windows separators", () => {
        const win = new Unpacker(
            "N/A",
            { ...prelude, entryPoint: "C:\\snapshot\\app\\index.js" },
            -1,
        );

        expect(
            win["toOutPath"]("C:\\snapshot\\app\\index.js", "/out"),
        ).toBe(path.join("/out", "app", "index.js"));
    });
});
