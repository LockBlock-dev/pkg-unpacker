import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { buildNexeFrame, buildTestZip } from "../../tests/helpers.js";
import NexeUnpacker from "./unpacker.js";

const frameOf = () =>
    buildNexeFrame(
        buildTestZip([
            {
                name: "snapshot/index.js",
                content: Buffer.from('console.log("nexe");\n'),
                mode: 0o644,
                deflated: true,
            },
            {
                name: "snapshot/lib/util.js",
                content: Buffer.from("module.exports = 1;\n"),
                mode: 0o644,
            },
        ]),
    );

describe("NexeUnpacker", () => {
    test("unpacks new-style archives", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-nexe.bin");
        const out = path.join(dir, "out");

        await fs.writeFile(bin, frameOf());

        const unpacker = await NexeUnpacker.create(bin);
        const result = await unpacker.unpack(out);

        expect(result.format).toBe("nexe");
        expect(result.entrypoint).toBe("snapshot/index.js");
        expect(result.files.map((file) => file.path)).toEqual([
            path.join(out, "index.js"),
            path.join(out, "lib", "util.js"),
        ]);
        expect(result.files.map((file) => file.kind)).toEqual([
            "source",
            "source",
        ]);
        expect(result.skipped).toEqual([]);
        expect(result.warnings).toEqual([]);

        expect(await fs.readFile(path.join(out, "index.js"), "utf-8")).toBe(
            'console.log("nexe");\n',
        );
        expect(
            (await fs.stat(path.join(out, "index.js"))).mode & 0o777,
        ).toBe(0o644);

        await fs.rm(dir, { recursive: true });
    });

    test("unpacks old-style archives", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-nexe-old.bin");
        const out = path.join(dir, "out");
        const manifest = JSON.stringify({ resources: { "a.js": [0, 5] } });

        await fs.writeFile(
            bin,
            Buffer.concat([
                Buffer.from("junk"),
                Buffer.from(
                    `!(function () {process.__nexe = ${manifest}\n    })();;`,
                ),
                Buffer.from("data!"),
            ]),
        );

        const unpacker = await NexeUnpacker.create(bin);
        const result = await unpacker.unpack(out);

        expect(result.files.map((file) => file.path)).toEqual([
            path.join(out, "a.js"),
        ]);
        expect(await fs.readFile(path.join(out, "a.js"), "utf-8")).toBe(
            "data!",
        );

        await fs.rm(dir, { recursive: true });
    });

    test("create rejects files without an archive", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-nexe.bin");

        await fs.writeFile(bin, "definitely not a binary");

        await expect(NexeUnpacker.create(bin)).rejects.toThrow(
            /Cannot find the nexe payload/,
        );

        await fs.rm(dir, { recursive: true });
    });
});
