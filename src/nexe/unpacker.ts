import fs from "node:fs/promises";
import path from "node:path";

import {
    NEXE_OLD_CODE_MARKER,
    NEXE_OLD_MARKER,
    NEXE_SENTINEL,
    NEXE_TAIL_WINDOW,
} from "./constants.js";
import { parseZip } from "./zip.js";
import {
    SOURCE_EXTS,
    applyMode,
    createOutputWriter,
    createResultCollector,
    ensureDir,
    isOutside,
    stripPrefix,
    writeSymlinkOut,
} from "../utils.js";
import type {
    FormatUnpacker,
    UnpackFormat,
    UnpackOptions,
    UnpackResult,
} from "../types.js";

export interface NexeArchive {
    entrypoint: string;
    files: Array<{
        name: string;
        data: Buffer;
        mode?: number;
        link?: string;
        dir: boolean;
    }>;
}

const stripName = (name: string) => stripPrefix(name, "snapshot/");

const findNewArchive = (file: Buffer) => {
    const tailSize = Math.min(file.length, NEXE_TAIL_WINDOW);
    const tail = file.subarray(file.length - tailSize);
    const at = tail.lastIndexOf(NEXE_SENTINEL);

    if (at === -1) return null;

    const footer = tail.subarray(at, at + NEXE_SENTINEL.length + 16);

    if (footer.length < NEXE_SENTINEL.length + 16) return null;

    const contentSize = footer.readDoubleLE(NEXE_SENTINEL.length);
    const resourceSize = footer.readDoubleLE(NEXE_SENTINEL.length + 8);

    if (
        !Number.isInteger(contentSize) ||
        !Number.isInteger(resourceSize) ||
        contentSize < 0 ||
        resourceSize <= 0
    )
        return null;

    const resourceEnd = file.length - tailSize + at;
    const resourceStart = resourceEnd - resourceSize;

    if (resourceStart < 0) return null;

    try {
        return parseZip(
            Buffer.from(file.subarray(resourceStart, resourceEnd)),
        );
    } catch {
        return null;
    }
};

const findOldArchive = (file: Buffer) => {
    const markerAt = file.indexOf(Buffer.from(NEXE_OLD_MARKER));

    if (markerAt === -1) return null;

    let start = file.indexOf(Buffer.from("{"), markerAt);

    while (start !== -1) {
        let depth = 0;
        let end = -1;

        for (let i = start; i < file.length; i++) {
            if (file[i] === 0x7b) depth += 1;
            else if (file[i] === 0x7d) {
                depth -= 1;

                if (depth === 0) {
                    end = i + 1;
                    break;
                }
            }
        }

        if (end !== -1) {
            try {
                const manifest: unknown = JSON.parse(
                    file.subarray(start, end).toString("utf-8"),
                );

                if (
                    typeof manifest === "object" &&
                    manifest !== null &&
                    "resources" in manifest &&
                    typeof manifest.resources === "object" &&
                    manifest.resources !== null
                ) {
                    const codeAt = file.indexOf(
                        Buffer.from(NEXE_OLD_CODE_MARKER),
                        end,
                    );

                    if (codeAt !== -1)
                        return {
                            resources: manifest.resources as Record<
                                string,
                                [number, number]
                            >,
                            codeStart: codeAt + NEXE_OLD_CODE_MARKER.length,
                            file,
                        };
                }
            } catch {}
        }

        start = file.indexOf(Buffer.from("{"), start + 1);
    }

    return null;
};

export function findNexeArchive(file: Buffer): NexeArchive | null {
    const entries = findNewArchive(file);

    if (entries) {
        const files = entries.map((entry) => ({
            name: entry.name,
            data: entry.data,
            mode: entry.type === "file" || entry.type === "dir" ? entry.mode : undefined,
            link: entry.link,
            dir: entry.type === "dir",
        }));
        const entrypoint =
            entries.find(
                (entry) =>
                    entry.type === "file" && /\.m?[jt]s$/i.test(entry.name),
            )?.name ?? entries[0]?.name ?? "";

        return { entrypoint, files };
    }

    const old = findOldArchive(file);

    if (old) {
        const files = Object.entries(old.resources)
            .filter(
                (entry): entry is [string, [number, number]] =>
                    Array.isArray(entry[1]) &&
                    typeof entry[1][0] === "number" &&
                    typeof entry[1][1] === "number",
            )
            .map(([name, range]) => ({
                name,
                data: Buffer.from(
                    old.file.subarray(
                        old.codeStart + range[0],
                        old.codeStart + range[0] + range[1],
                    ),
                ),
                dir: false,
            }));
        const entrypoint =
            files.find((file) => /\.m?[jt]s$/i.test(file.name))?.name ?? "";

        return { entrypoint, files };
    }

    return null;
}

export default class NexeUnpacker implements FormatUnpacker {
    public readonly format: UnpackFormat = "nexe";

    private constructor(
        private filePath: string,
        private archive: NexeArchive,
    ) {}

    static async create(filePath: string) {
        const file = await fs.readFile(filePath);
        const archive = findNexeArchive(file);

        if (!archive)
            throw new Error(
                "Cannot find the nexe payload! This might happen if your binary is not readable or uses an unknown layout.",
            );

        return new NexeUnpacker(filePath, archive);
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
                `Unpacking your binary, ${this.archive.files.length} elements to go...`,
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

        for (const file of this.archive.files) {
            const name = stripName(file.name);

            if (file.dir) {
                const outDir = path.join(outputPath, name);

                if (isOutside(outDir, outputPath)) {
                    skipped.push({ path: outDir, reason: "outside output directory" });
                    continue;
                }

                await ensureDir(outDir, knownDirs);
                await applyMode(outDir, file.mode, warn);

                continue;
            }

            if (file.link !== undefined) {
                await writeSymlinkOut(
                    outputPath,
                    name,
                    file.link,
                    links,
                    skipped,
                    warn,
                    written,
                    knownDirs,
                );

                continue;
            }

            const ext = path.extname(name).toLowerCase();
            const outPath = await writeOut(
                name,
                file.data,
                SOURCE_EXTS.has(ext) ? "source" : "asset",
            );

            if (outPath !== null)
                await applyMode(outPath, file.mode, warn, name);
        }

        if (shouldRun)
            warn("Execution is not supported for nexe binaries.");

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
