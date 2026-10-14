import { describe, expect, test } from "bun:test";

import {
    buildTestZip,
} from "../../tests/helpers.js";
import { parseZip } from "./zip.js";

describe("parseZip", () => {
    test("parses stored entries", () => {
        const entries = parseZip(
            buildTestZip([
                { name: "a.txt", content: Buffer.from("hi"), mode: 0o644 },
            ]),
        );

        expect(entries).toEqual([
            {
                name: "a.txt",
                mode: 0o644,
                type: "file",
                data: Buffer.from("hi"),
            },
        ]);
    });

    test("parses deflated entries", () => {
        const entries = parseZip(
            buildTestZip([
                {
                    name: "a.txt",
                    content: Buffer.from("hi deflated"),
                    mode: 0o644,
                    deflated: true,
                },
            ]),
        );

        expect(entries).toEqual([
            {
                name: "a.txt",
                mode: 0o644,
                type: "file",
                data: Buffer.from("hi deflated"),
            },
        ]);
    });

    test("rejects garbage", () => {
        expect(() => parseZip(Buffer.from("nothing here"))).toThrow();
        expect(() =>
            parseZip(
                buildTestZip([{ name: "a", content: Buffer.alloc(0) }]).subarray(
                    0,
                    40,
                ),
            ),
        ).toThrow();
    });

    test("masks setuid/setgid/sticky bits", () => {
        const entries = parseZip(
            buildTestZip([
                { name: "evil", content: Buffer.from("x"), mode: 0o4755 },
            ]),
        );

        expect(entries[0]?.mode).toBe(0o755);
    });
});
