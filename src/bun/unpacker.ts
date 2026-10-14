import fs from "node:fs/promises";
import path from "node:path";

import { BUNFS_ROOT } from "./constants.js";
import { findBunArchive, type BunArchive } from "./parser.js";
import {
    SOURCE_EXTS,
    createOutputWriter,
    createResultCollector,
    stripPrefix,
} from "../utils.js";
import type {
    FormatUnpacker,
    UnpackFormat,
    UnpackOptions,
    UnpackResult,
} from "../types.js";

const isText = (data: Buffer) => {
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(data);
        return true;
    } catch {
        return false;
    }
};

export default class BunUnpacker implements FormatUnpacker {
    public readonly format: UnpackFormat = "bun";

    private constructor(
        private filePath: string,
        private archive: BunArchive,
    ) {}

    static async create(filePath: string) {
        const file = await fs.readFile(filePath);
        const archive = findBunArchive(file);

        if (!archive)
            throw new Error(
                "Cannot find the Bun payload! This might happen if your binary is not readable or uses an unknown layout.",
            );

        return new BunUnpacker(filePath, archive);
    }

    private stripName(name: string) {
        return stripPrefix(name, BUNFS_ROOT);
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
                `Unpacking your binary, ${this.archive.files.length + 1} elements to go...`,
            );
        }

        const { files, skipped, symlinks, warnings, warn } =
            createResultCollector();

        const outputPath = path.resolve(outputFolder);
        const knownDirs = new Set<string>();
        const { writeOut } = createOutputWriter(
            outputPath,
            files,
            skipped,
            knownDirs,
        );
        const covered = new Set(
            this.archive.files.map((file) => this.stripName(file.name)),
        );

        const uncovered = [...new Set(this.archive.names)].filter(
            (name) => !covered.has(this.stripName(name)),
        );
        const hasCode =
            uncovered.length > 0 &&
            this.archive.code.some((byte) => byte !== 0);

        if (hasCode) {
            const name = this.stripName(uncovered[0] as string);

            await writeOut(
                name,
                this.archive.code,
                isText(this.archive.code) ? "source" : "bytecode",
            );
        }

        for (const file of this.archive.files) {
            const ext = path.extname(file.name).toLowerCase();

            await writeOut(
                this.stripName(file.name),
                file.data,
                SOURCE_EXTS.has(ext) ? "source" : "asset",
            );
        }

        for (const name of uncovered.slice(hasCode ? 1 : 0))
            skipped.push({ path: name, reason: "no data" });

        if (shouldRun)
            warn("Execution is not supported for bun binaries.");

        if (!json) console.log(`Binary unpacked to ${outputFolder}!`);

        return {
            outputDir: outputPath,
            entrypoint: this.archive.entrypoint,
            compression: "NONE",
            format: this.format,
            files,
            skipped,
            symlinks,
            warnings,
        };
    }
}
