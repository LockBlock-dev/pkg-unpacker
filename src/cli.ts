import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import Unpacker from "./unpacker.js";
import { isBun } from "./utils.js";
import { VERSION } from "./version.js";

class Cli {
    private program: Command;

    constructor() {
        this.program = new Command();
    }

    private setup() {
        this.program
            .name("pkg-unpacker")
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
            .option("--run", "Run the unpacked binary", false)
            .option("--json", "Output the unpack result as JSON", false);

        this.program.parse();

        const options = this.program.opts();

        if (!options.input || !options.output) {
            console.error("Both -i (input) and -o (output) are required.");
            process.exit(1);
        }

        if (options.run && isBun()) {
            console.error(
                "--run is not supported under Bun: the entrypoint is V8 bytecode and Bun runs JavaScriptCore.",
            );
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
        };
    }

    public async run() {
        const { inputPath, outputPath, shouldRun, json } = this.setup();

        const unpacker = await Unpacker.create(inputPath);
        const result = await unpacker.unpack(outputPath, shouldRun, { json });

        if (json) console.log(JSON.stringify(result, null, 2));
    }
}

export default Cli;
