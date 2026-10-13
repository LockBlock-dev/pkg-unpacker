import { readFileSync } from "node:fs";
import path from "node:path";

const PACKAGE_NAME = "pkg-unpacker";
const CANDIDATES = ["../package.json", "package.json"].map((p) =>
    path.join(import.meta.dirname, p),
);

function readVersion(): string {
    for (const candidate of CANDIDATES) {
        try {
            const parsed: unknown = JSON.parse(
                readFileSync(candidate, "utf-8"),
            );

            if (
                typeof parsed === "object" &&
                parsed !== null &&
                "name" in parsed &&
                parsed.name === PACKAGE_NAME &&
                "version" in parsed &&
                typeof parsed.version === "string"
            )
                return parsed.version;
        } catch {}
    }

    return "unknown";
}

export const VERSION = readVersion();
