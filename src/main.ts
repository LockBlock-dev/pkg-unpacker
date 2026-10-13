import process from "node:process";

import UnpackerCli from "./cli.js";

try {
    await new UnpackerCli().run();
} catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
}
