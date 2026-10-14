import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { buildTestArchive } from "../../tests/helpers.js";
import BunUnpacker from "./unpacker.js";

const frameOf = (archive: Buffer) =>
    Buffer.concat([Buffer.from("junk"), archive, Buffer.alloc(64)]);

const multi = () =>
    buildTestArchive({
        bundle: { name: "/$bunfs/root/multi", code: Buffer.from("// @bun\n") },
        files: [
            { name: "/$bunfs/root/a.txt", data: Buffer.from("ALPHA_CONTENT") },
            { name: "/$bunfs/root/b.txt", data: Buffer.from("BETA_CONTENT") },
        ],
    });

describe("BunUnpacker", () => {
    test("unpacks bundle and assets", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-bun.bin");
        const out = path.join(dir, "out");

        await fs.writeFile(bin, frameOf(multi()));

        const unpacker = await BunUnpacker.create(bin);
        const result = await unpacker.unpack(out);

        expect(result.format).toBe("bun");
        expect(result.entrypoint).toBe("/$bunfs/root/multi");
        expect(result.compression).toBe("NONE");
        expect(result.files.map((file) => file.path)).toEqual([
            path.join(out, "multi"),
            path.join(out, "a.txt"),
            path.join(out, "b.txt"),
        ]);
        expect(result.files.map((file) => file.kind)).toEqual([
            "source",
            "source",
            "source",
        ]);
        expect(result.skipped).toEqual([]);
        expect(result.warnings).toEqual([]);

        expect(await fs.readFile(path.join(out, "a.txt"), "utf-8")).toBe(
            "ALPHA_CONTENT",
        );

        await fs.rm(dir, { recursive: true });
    });

    test("keeps nested paths and kinds", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-bun.bin");
        const out = path.join(dir, "out");
        const archive = buildTestArchive({
            bundle: {
                name: "/$bunfs/root/withdir",
                code: Buffer.from("// @bun\n"),
            },
            files: [
                {
                    name: "/$bunfs/root/public/g.dat",
                    data: Buffer.from("GAMMA"),
                },
                {
                    name: "/$bunfs/root/public/index.html",
                    data: Buffer.from("<h1>hi</h1>"),
                },
            ],
        });

        await fs.writeFile(bin, frameOf(archive));

        const unpacker = await BunUnpacker.create(bin);
        const result = await unpacker.unpack(out);

        expect(result.files.map((file) => file.path)).toEqual([
            path.join(out, "withdir"),
            path.join(out, "public", "g.dat"),
            path.join(out, "public", "index.html"),
        ]);
        expect(result.files.map((file) => file.kind)).toEqual([
            "source",
            "asset",
            "source",
        ]);

        await fs.rm(dir, { recursive: true });
    });

    test("create rejects files without an archive", async () => {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "pkg-unpacker-"));
        const bin = path.join(dir, "fake-bun.bin");

        await fs.writeFile(bin, "definitely not a binary");

        await expect(BunUnpacker.create(bin)).rejects.toThrow(
            /Cannot find the Bun payload/,
        );

        await fs.rm(dir, { recursive: true });
    });
});
