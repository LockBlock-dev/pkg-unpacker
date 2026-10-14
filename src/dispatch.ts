import fs from "node:fs/promises";

import { PROPS_SCAN_WINDOW, RAW_PROPS_REGEX } from "./constants.js";
import { UnpackerReadError } from "./errors.js";
import { findSeaBlob } from "./sea/parser.js";
import { findBunArchive } from "./bun/parser.js";
import { findNexeArchive } from "./nexe/unpacker.js";
import { findCaxaArchive } from "./caxa/unpacker.js";
import type {
    FormatOption,
    FormatUnpacker,
    UnpackFormat,
} from "./types.js";
import PkgUnpacker from "./pkg/unpacker.js";
import SeaUnpacker from "./sea/unpacker.js";
import BunUnpacker from "./bun/unpacker.js";
import NexeUnpacker from "./nexe/unpacker.js";
import CaxaUnpacker from "./caxa/unpacker.js";

const DETECT_PATTERN = new RegExp(RAW_PROPS_REGEX.source);

export async function detectFormat(filePath: string): Promise<UnpackFormat> {
    const handle = await fs.open(filePath, "r");

    try {
        const { size } = await handle.stat();
        const windowSize = Math.min(size, PROPS_SCAN_WINDOW);
        const tail = Buffer.alloc(windowSize);

        await handle.read({
            buffer: tail,
            offset: 0,
            length: windowSize,
            position: size - windowSize,
        });

        if (DETECT_PATTERN.test(tail.toString("utf-8"))) return "pkg";
        if (findBunArchive(tail)) return "bun";
    } finally {
        await handle.close();
    }

    const file = await fs.readFile(filePath);

    if (findSeaBlob(file)) return "sea";
    if (findNexeArchive(file)) return "nexe";
    if (findCaxaArchive(file)) return "caxa";

    throw new UnpackerReadError(`Unsupported binary format: ${filePath}.`);
}

export async function createUnpacker(
    filePath: string,
    format: FormatOption = "auto",
): Promise<FormatUnpacker> {
    const resolved = format === "auto" ? await detectFormat(filePath) : format;

    switch (resolved) {
        case "pkg":
            return PkgUnpacker.create(filePath);
        case "sea":
            return SeaUnpacker.create(filePath);
        case "bun":
            return BunUnpacker.create(filePath);
        case "nexe":
            return NexeUnpacker.create(filePath);
        case "caxa":
            return CaxaUnpacker.create(filePath);
        default:
            throw new Error(`Unknown format: ${format}.`);
    }
}
