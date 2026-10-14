import { gunzipSync } from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";

import { CAXA_FOOTER_MARKER, CAXA_SEPARATOR } from "./constants.js";
import { parseTar } from "./tar.js";
import {
    SOURCE_EXTS,
    applyMode,
    createOutputWriter,
    createResultCollector,
    ensureDir,
    isOutside,
    writeSymlinkOut,
} from "../utils.js";
import type {
    FormatUnpacker,
    UnpackFormat,
    UnpackOptions,
    UnpackResult,
} from "../types.js";

export interface CaxaArchive {
    entrypoint: string;
    entries: ReturnType<typeof parseTar>;
}

export function findCaxaArchive(file: Buffer): CaxaArchive | null {
    const at = file.indexOf(CAXA_SEPARATOR);

    if (at === -1) return null;

    const start = at + CAXA_SEPARATOR.length + 1;

    if (
        file[start] !== 0x1f ||
        file[start + 1] !== 0x8b
    )
        return null;

    const end = file.lastIndexOf(Buffer.from(CAXA_FOOTER_MARKER));

    if (end === -1 || end <= start) return null;

    let depth = 0;
    let objEnd = -1;

    for (let i = end + 1; i < file.length; i++) {
        if (file[i] === 0x7b) depth += 1;
        else if (file[i] === 0x7d) {
            depth -= 1;

            if (depth === 0) {
                objEnd = i + 1;
                break;
            }
        }
    }

    if (objEnd === -1) return null;

    let footer: unknown;

    try {
        footer = JSON.parse(file.subarray(end + 1, objEnd).toString("utf-8"));
    } catch {
        return null;
    }

    if (
        typeof footer !== "object" ||
        footer === null ||
        !("command" in footer) ||
        !Array.isArray(footer.command) ||
        !footer.command.every((part) => typeof part === "string")
    )
        return null;

    let entries;

    try {
        entries = parseTar(gunzipSync(file.subarray(start, end)));
    } catch {
        return null;
    }

    return {
        entrypoint: (footer.command as string[]).join(" "),
        entries,
    };
}

export default class CaxaUnpacker implements FormatUnpacker {
    public readonly format: UnpackFormat = "caxa";

    private constructor(
        private filePath: string,
        private archive: CaxaArchive,
    ) {}

    static async create(filePath: string) {
        const file = await fs.readFile(filePath);
        const archive = findCaxaArchive(file);

        if (!archive)
            throw new Error(
                "Cannot find the caxa payload! This might happen if your binary is not readable or uses an unknown layout.",
            );

        return new CaxaUnpacker(filePath, archive);
    }

    public async unpack(
        outputFolder: string = ".",
        shouldRun: boolean = false,
        options: UnpackOptions = {},
    ): Promise<UnpackResult> {
        const json = options.json ?? false;

        if (!json) {
            console.log(`Detected entrypoint: ${this.archive.entrypoint}`);
            console.log(
                `Unpacking your binary, ${this.archive.entries.length} elements to go...`,
            );
        }

        const { files, skipped, symlinks: links, warnings, warn } =
            createResultCollector();

        const outputPath = path.resolve(outputFolder);
        const knownDirs = new Set<string>();
        const { writeOut, written } = createOutputWriter(
            outputPath,
            files,
            skipped,
            knownDirs,
        );

        for (const entry of this.archive.entries) {
            if (entry.type === "dir") {
                const outDir = path.join(outputPath, entry.name);

                if (isOutside(outDir, outputPath)) {
                    skipped.push({ path: outDir, reason: "outside output directory" });
                    continue;
                }

                await ensureDir(outDir, knownDirs);
                await applyMode(outDir, entry.mode, warn);

                continue;
            }

            if (entry.type === "symlink" && entry.link !== undefined) {
                await writeSymlinkOut(
                    outputPath,
                    entry.name,
                    entry.link,
                    links,
                    skipped,
                    warn,
                    written,
                    knownDirs,
                );

                continue;
            }

            if (entry.type !== "file") {
                skipped.push({
                    path: path.join(outputPath, entry.name),
                    reason: "unsupported entry",
                });
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            const outPath = await writeOut(
                entry.name,
                entry.data,
                SOURCE_EXTS.has(ext) ? "source" : "asset",
            );

            if (outPath !== null)
                await applyMode(outPath, entry.mode, warn, entry.name);
        }

        if (shouldRun)
            warn("Execution is not supported for caxa binaries.");

        if (!json) console.log(`Binary unpacked to ${outputFolder}!`);

        return {
            outputDir: outputPath,
            entrypoint: this.archive.entrypoint,
            compression: "NONE",
            format: this.format,
            files,
            skipped,
            symlinks: links,
            warnings,
        };
    }
}
