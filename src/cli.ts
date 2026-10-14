import { Command, Option } from "commander";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createUnpacker } from "./dispatch.js";
import type { FormatOption } from "./types.js";
import { VERSION } from "./version.js";

class Cli {
    private program: Command;

    constructor() {
        this.program = new Command();
    }

    private setup() {
        this.program
            .name("pkg-unpacker")
            .description(
                "Unpack pkg, nexe, caxa, Node.js SEA and Bun single-file binaries. The format is auto-detected by default.",
            )
            .version(VERSION)
            .requiredOption(
                "-i, --input <file>",
                "Specify the input binary file path",
            )
            .option(
                "-o, --output <folder>",
                "Specify the output folder path",
                ".",
            )
            .option(
                "--run",
                "Run the unpacked entrypoint (pkg binaries on Node.js only)",
                false,
            )
            .option("--json", "Output the unpack result as JSON", false)
            .addOption(
                new Option(
                    "--format <format>",
                    "Binary format to unpack (default: auto)",
                )
                    .default("auto")
                    .choices(["pkg", "sea", "bun", "nexe", "caxa", "auto"]),
            );

        this.program.parse();

        const options = this.program.opts();

        if (!options.input || !options.output) {
            console.error("Both -i (input) and -o (output) are required.");
            process.exit(1);
        }

        const inputPath = path.resolve(options.input);
        const outputPath = path.resolve(options.output);

        if (!fs.existsSync(inputPath)) {
            console.error("The provided binary file does not exist!");
            process.exit(1);
        }

        return {
            inputPath,
            outputPath,
            shouldRun: options.run as boolean,
            json: options.json as boolean,
            format: options.format as FormatOption,
        };
    }

    public async run() {
        const { inputPath, outputPath, shouldRun, json, format } =
            this.setup();

        const unpacker = await createUnpacker(inputPath, format);
        const result = await unpacker.unpack(outputPath, shouldRun, { json });

        if (json) console.log(JSON.stringify(result, null, 2));
    }
}

export default Cli;
