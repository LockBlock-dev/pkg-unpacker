import { describe, expect, test } from "bun:test";

import { buildTestArchive } from "../../tests/helpers.js";
import { findBunArchive } from "./parser.js";

const multi = () =>
    buildTestArchive({
        bundle: { name: "/$bunfs/root/multi", code: Buffer.from("// @bun\n") },
        files: [
            { name: "/$bunfs/root/a.txt", data: Buffer.from("ALPHA_CONTENT") },
            { name: "/$bunfs/root/b.txt", data: Buffer.from("BETA_CONTENT") },
        ],
    });

describe("findBunArchive", () => {
    test("parses a multi-file archive", () => {
        const archive = findBunArchive(multi());

        expect(archive?.entrypoint).toBe("/$bunfs/root/multi");
        expect(archive?.code.subarray(0, 7).toString()).toBe("// @bun");
        expect(archive?.files.map((file) => file.name)).toEqual([
            "/$bunfs/root/a.txt",
            "/$bunfs/root/b.txt",
        ]);
        expect(archive?.files[0]?.data.toString()).toBe("ALPHA_CONTENT");
        expect(archive?.files[1]?.data.toString()).toBe("BETA_CONTENT");
    });

    test("parses nested paths", () => {
        const archive = findBunArchive(
            buildTestArchive({
                bundle: { name: "/$bunfs/root/app", code: Buffer.from("// @bun\n") },
                files: [
                    {
                        name: "/$bunfs/root/public/g.dat",
                        data: Buffer.from("GAMMA"),
                    },
                ],
            }),
        );

        expect(archive?.files.map((file) => file.name)).toEqual([
            "/$bunfs/root/public/g.dat",
        ]);
    });

    test("returns null for junk", () => {
        expect(findBunArchive(Buffer.from("nothing here"))).toBeNull();
        expect(findBunArchive(Buffer.alloc(0))).toBeNull();
    });

    test("skips corrupt entries", () => {
        const full = multi();
        const cut = full.subarray(0, full.length - 60);
        const archive = findBunArchive(cut);

        expect(archive?.files.map((file) => file.name)).toEqual([
            "/$bunfs/root/a.txt",
        ]);
    });

    test("ignores zero-kind records", () => {
        const archive = buildTestArchive({
            bundle: { name: "/$bunfs/root/m", code: Buffer.from("// @bun\n") },
            files: [
                { name: "/$bunfs/root/a.txt", data: Buffer.from("A") },
            ],
        });
        const name = "/$bunfs/root/a.txt";
        const phantom = Buffer.alloc(20);
        phantom.writeUInt32LE(0, 0);
        phantom.writeUInt32LE(archive.indexOf(name), 4);
        phantom.writeUInt32LE(name.length + 1, 8);
        phantom.writeUInt32LE(0, 12);
        phantom.writeUInt32LE(0, 16);

        const parsed = findBunArchive(Buffer.concat([archive, phantom]));

        expect(parsed?.files.map((file) => file.name)).toEqual([
            "/$bunfs/root/a.txt",
        ]);
    });
});
