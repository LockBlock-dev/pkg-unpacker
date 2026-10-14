import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import SeaUnpacker from "./unpacker.js";

const ASSETS_BLOB =
    "INpDAQgAAAABBAAAAAAAAABtLmpzEgAAAAAAAABjb25zb2xlLmxvZygidiIpOwoCAAAAAAAAAAkAAAAAAAAAZW1wdHkudHh0AAAAAAAAAAAHAAAAAAAAAGJpZy50eHRkAAAAAAAAAEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=";

describe("SeaUnpacker", () => {
    test("unpacks main script and assets", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-sea.bin");
        const out = path.join(dir, "out");

        await fs.writeFile(
            bin,
            Buffer.concat([
                Buffer.from("junk"),
                Buffer.from(ASSETS_BLOB, "base64"),
                Buffer.alloc(64),
            ]),
        );

        const unpacker = await SeaUnpacker.create(bin);
        const result = await unpacker.unpack(out);

        expect(result.format).toBe("sea");
        expect(result.entrypoint).toBe("m.js");
        expect(result.compression).toBe("NONE");
        expect(result.files.map((file) => file.path)).toEqual([
            path.join(out, "m.js"),
            path.join(out, "empty.txt"),
            path.join(out, "big.txt"),
        ]);
        expect(result.files.map((file) => file.kind)).toEqual([
            "source",
            "asset",
            "asset",
        ]);
        expect(result.skipped).toEqual([]);
        expect(result.warnings).toEqual([]);

        expect(await fs.readFile(path.join(out, "m.js"), "utf-8")).toBe(
            'console.log("v");\n',
        );
        expect(await fs.readFile(path.join(out, "big.txt"), "utf-8")).toBe(
            "A".repeat(100),
        );

        await fs.rm(dir, { recursive: true });
    });

    test("create rejects files without a blob", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-sea.bin");

        await fs.writeFile(bin, "definitely not a binary");

        await expect(SeaUnpacker.create(bin)).rejects.toThrow(
            /Cannot find the SEA payload/,
        );

        await fs.rm(dir, { recursive: true });
    });
});
