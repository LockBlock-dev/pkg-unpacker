import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { buildCaxaFrame, buildTestTar } from "../../tests/helpers.js";
import CaxaUnpacker from "./unpacker.js";

const frameOf = () =>
    buildCaxaFrame(
        buildTestTar([
            {
                name: "index.js",
                content: Buffer.from('console.log("caxa");\n'),
                mode: 0o644,
            },
            { name: "sub/", content: Buffer.alloc(0), mode: 0o755 },
            {
                name: "sub/data.txt",
                content: Buffer.from("data here\n"),
                mode: 0o644,
            },
        ]),
    );

describe("CaxaUnpacker", () => {
    test("unpacks tar entries", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-caxa.bin");
        const out = path.join(dir, "out");

        await fs.writeFile(
            bin,
            Buffer.concat([Buffer.from("junk"), frameOf(), Buffer.alloc(32)]),
        );

        const unpacker = await CaxaUnpacker.create(bin);
        const result = await unpacker.unpack(out);

        expect(result.format).toBe("caxa");
        expect(result.entrypoint).toContain("index.js");
        expect(result.files.map((file) => file.path)).toEqual([
            path.join(out, "index.js"),
            path.join(out, "sub", "data.txt"),
        ]);
        expect(result.files.map((file) => file.kind)).toEqual([
            "source",
            "source",
        ]);
        expect(result.skipped).toEqual([]);
        expect(result.warnings).toEqual([]);

        expect(await fs.readFile(path.join(out, "index.js"), "utf-8")).toBe(
            'console.log("caxa");\n',
        );
        expect(await fs.readFile(path.join(out, "sub", "data.txt"), "utf-8")).toBe(
            "data here\n",
        );
        expect((await fs.stat(path.join(out, "index.js"))).mode & 0o777).toBe(
            0o644,
        );

        await fs.rm(dir, { recursive: true });
    });

    test("create rejects files without an archive", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-caxa.bin");

        await fs.writeFile(bin, "definitely not a binary");

        await expect(CaxaUnpacker.create(bin)).rejects.toThrow(
            /Cannot find the caxa payload/,
        );

        await fs.rm(dir, { recursive: true });
    });
});
