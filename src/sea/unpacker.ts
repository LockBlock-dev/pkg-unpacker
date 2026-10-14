import fs from "node:fs/promises";
import path from "node:path";

import { findSeaBlob, type SeaBlob } from "./parser.js";
import {
    createOutputWriter,
    createResultCollector,
} from "../utils.js";
import type {
    FormatUnpacker,
    UnpackFormat,
    UnpackOptions,
    UnpackResult,
} from "../types.js";

export default class SeaUnpacker implements FormatUnpacker {
    public readonly format: UnpackFormat = "sea";

    private constructor(
        private filePath: string,
        private blob: SeaBlob,
    ) {}

    static async create(filePath: string) {
        const file = await fs.readFile(filePath);
        const blob = findSeaBlob(file);

        if (!blob)
            throw new Error(
                "Cannot find the SEA payload! This might happen if your binary is not readable or uses an unknown layout.",
            );

        return new SeaUnpacker(filePath, blob);
    }

    private baseName(name: string) {
        return name.includes("\\")
            ? path.win32.basename(name)
            : path.basename(name);
    }

    public async unpack(
        outputFolder: string = ".",
        shouldRun: boolean = false,
        options: UnpackOptions = {},
    ): Promise<UnpackResult> {
        const json = options.json ?? false;

        if (!json) {
            console.log(`Detected entrypoint: ${this.blob.main.name}`);
            console.log(
                `Unpacking your binary, ${this.blob.assets.length + 1} elements to go...`,
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

        if (this.blob.main.source) {
            await writeOut(
                this.baseName(this.blob.main.name),
                this.blob.main.source,
                "source",
            );
        } else {
            skipped.push({
                path: this.blob.main.name,
                reason: "snapshot not recoverable",
            });
        }

        for (const asset of this.blob.assets) {
            await writeOut(asset.key, asset.data, "asset");
        }

        if (shouldRun)
            warn("Execution is not supported for sea binaries.");

        if (!json) console.log(`Binary unpacked to ${outputFolder}!`);

        return {
            outputDir: outputPath,
            entrypoint: this.blob.main.name,
            compression: "NONE",
            format: this.format,
            files,
            skipped,
            symlinks,
            warnings,
        };
    }
}
