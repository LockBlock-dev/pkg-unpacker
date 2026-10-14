import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { createUnpacker, detectFormat } from "./dispatch.js";
import {
    buildCaxaFrame,
    buildNexeFrame,
    buildTestArchive,
    buildTestTar,
    buildTestZip,
} from "../tests/helpers.js";
import type { FormatOption } from "./types.js";
import PkgUnpacker from "./pkg/unpacker.js";

const writeTemp = async (content: string | Uint8Array) => {
    const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
    const file = path.join(dir, "fake.bin");

    await fs.writeFile(file, content);

    return { dir, file };
};

describe("detectFormat", () => {
    test("detects pkg binaries", async () => {
        const { dir, file } = await writeTemp(
            '{"a":{"0":[0,1]}}\n,\n"/x"\n,\n{}\n,\n{}\n,\n0',
        );

        await expect(detectFormat(file)).resolves.toBe("pkg");

        await fs.rm(dir, { recursive: true });
    });

    test("rejects unknown binaries", async () => {
        const { dir, file } = await writeTemp("definitely not a binary");

        await expect(detectFormat(file)).rejects.toThrow(
            /Unsupported binary format/,
        );

        await fs.rm(dir, { recursive: true });
    });

    test("detects bun binaries", async () => {
        const { dir, file } = await writeTemp(
            Buffer.concat([
                Buffer.from("junk"),
                buildTestArchive({
                    bundle: {
                        name: "/$bunfs/root/app",
                        code: Buffer.from("// @bun\n"),
                    },
                    files: [
                        {
                            name: "/$bunfs/root/a.txt",
                            data: Buffer.from("A"),
                        },
                    ],
                }),
            ]),
        );

        await expect(detectFormat(file)).resolves.toBe("bun");

        await fs.rm(dir, { recursive: true });
    });

    test("detects caxa binaries", async () => {
        const { dir, file } = await writeTemp(
            buildCaxaFrame(
                buildTestTar([
                    {
                        name: "index.js",
                        content: Buffer.from("x"),
                        mode: 0o644,
                    },
                ]),
            ),
        );

        await expect(detectFormat(file)).resolves.toBe("caxa");

        await fs.rm(dir, { recursive: true });
    });

    test("detects nexe binaries", async () => {
        const { dir, file } = await writeTemp(
            buildNexeFrame(
                buildTestZip([
                    { name: "a", content: Buffer.from("b") },
                ]),
            ),
        );

        await expect(detectFormat(file)).resolves.toBe("nexe");

        await fs.rm(dir, { recursive: true });
    });
});

describe("createUnpacker", () => {
    test("creates a pkg unpacker explicitly", async () => {
        const { dir, file } = await writeTemp(
            "var PAYLOAD_POSITION = '99999999\n" +
                '{"a":{"0":[0,1]}}\n,\n"/x"\n,\n{}\n,\n{}\n,\n0',
        );

        const unpacker = await createUnpacker(file, "pkg");

        expect(unpacker).toBeInstanceOf(PkgUnpacker);
        expect(unpacker.format).toBe("pkg");

        await fs.rm(dir, { recursive: true });
    });

    test("rejects unknown formats", async () => {
        const { dir, file } = await writeTemp("definitely not a binary");

        await expect(
            createUnpacker(file, "exe" as FormatOption),
        ).rejects.toThrow(/Unknown format/);

        await fs.rm(dir, { recursive: true });
    });

    test("creates a sea unpacker explicitly", async () => {
        const { dir, file } = await writeTemp("definitely not a binary");

        await expect(createUnpacker(file, "sea")).rejects.toThrow(
            /Cannot find the SEA payload/,
        );

        await fs.rm(dir, { recursive: true });
    });
});
