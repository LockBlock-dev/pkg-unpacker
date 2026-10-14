import { describe, expect, test } from "bun:test";

import { buildTestTar } from "../../tests/helpers.js";
import { parseTar } from "./tar.js";

const tarOf = () =>
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
        {
            name: "link",
            content: Buffer.alloc(0),
            mode: 0o777,
            symlink: "index.js",
        },
    ]);

describe("parseTar", () => {
    test("parses entries", () => {
        const entries = parseTar(tarOf());

        expect(
            entries.map((entry) => [
                entry.name,
                entry.type,
                entry.mode,
            ]),
        ).toEqual([
            ["index.js", "file", 0o644],
            ["sub/", "dir", 0o755],
            ["sub/data.txt", "file", 0o644],
            ["link", "symlink", 0o777],
        ]);
        expect(entries[0]?.data.toString()).toBe('console.log("caxa");\n');
        expect(entries[3]?.link).toBe("index.js");
    });

    test("rejects bad checksum", () => {
        const tar = Buffer.from(tarOf());
        tar[100] = ((tar[100] ?? 0) ^ 0xff) as number;

        expect(() => parseTar(tar)).toThrow(/checksum/);
    });

    test("rejects truncated", () => {
        expect(() => parseTar(tarOf().subarray(0, 600))).toThrow();
    });

    test("masks setuid/setgid/sticky bits", () => {
        const entries = parseTar(
            buildTestTar([
                { name: "evil", content: Buffer.from("x"), mode: 0o4755 },
            ]),
        );

        expect(entries[0]?.mode).toBe(0o755);
    });
});
