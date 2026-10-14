import { describe, expect, test } from "bun:test";

import { findSeaBlob, parseSeaBlob } from "./parser.js";

const NONE_BLOB =
    "INpDAQAAAAABBAAAAAAAAABtLmpzEgAAAAAAAABjb25zb2xlLmxvZygidiIpOwo=";
const ASSETS_BLOB =
    "INpDAQgAAAABBAAAAAAAAABtLmpzEgAAAAAAAABjb25zb2xlLmxvZygidiIpOwoCAAAAAAAAAAkAAAAAAAAAZW1wdHkudHh0AAAAAAAAAAAHAAAAAAAAAGJpZy50eHRkAAAAAAAAAEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=";

const snapshotBlob = () => {
    const head = Buffer.from([
        0x20, 0xda, 0x43, 0x01, 0x02, 0x00, 0x00, 0x00, 0x01,
    ]);
    const name = Buffer.from("snap");
    const nameLen = Buffer.alloc(8);
    nameLen.writeBigUInt64LE(BigInt(name.length));
    const snapLen = Buffer.alloc(8);
    snapLen.writeBigUInt64LE(BigInt(16));

    return Buffer.concat([head, nameLen, name, snapLen, Buffer.alloc(16, 7)]);
};

describe("parseSeaBlob", () => {
    test("parses a main-only blob", () => {
        const blob = parseSeaBlob(Buffer.from(NONE_BLOB, "base64"), 0);

        expect(blob.main.name).toBe("m.js");
        expect(blob.main.snapshot).toBe(false);
        expect(blob.main.source?.toString("utf-8")).toBe(
            'console.log("v");\n',
        );
        expect(blob.assets).toEqual([]);
    });

    test("parses assets", () => {
        const blob = parseSeaBlob(Buffer.from(ASSETS_BLOB, "base64"), 0);

        expect(blob.assets.map((asset) => asset.key)).toEqual([
            "empty.txt",
            "big.txt",
        ]);
        expect(blob.assets[0]?.data.length).toBe(0);
        expect(blob.assets[1]?.data.toString("utf-8")).toBe("A".repeat(100));
    });

    test("skips snapshot mains", () => {
        const blob = parseSeaBlob(snapshotBlob(), 0);

        expect(blob.main.snapshot).toBe(true);
        expect(blob.main.source).toBeUndefined();
        expect(blob.assets).toEqual([]);
    });

    test("rejects corrupt blobs", () => {
        const buf = Buffer.from(NONE_BLOB, "base64");

        expect(() => parseSeaBlob(buf.subarray(0, 10), 0)).toThrow();
        expect(() =>
            parseSeaBlob(Buffer.concat([Buffer.from([0, 1, 2, 3]), buf.subarray(4)]), 0),
        ).toThrow();
    });

    test("findSeaBlob ignores junk", () => {
        expect(findSeaBlob(Buffer.from("nothing here"))).toBeNull();

        const framed = Buffer.concat([
            Buffer.from("junk"),
            Buffer.from(NONE_BLOB, "base64"),
            Buffer.alloc(64),
        ]);

        expect(findSeaBlob(framed)?.main.name).toBe("m.js");
    });
});
