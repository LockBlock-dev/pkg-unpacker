import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

import type {
    FileKind,
    UnpackResult,
} from "./types.js";

export const isBun = (): boolean => "bun" in process.versions;

export const SOURCE_EXTS = new Set([
    ".ts",
    ".mts",
    ".cts",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".html",
    ".css",
    ".txt",
    ".md",
]);

export const isOutside = (out: string, root: string) =>
    out !== root && !out.startsWith(root + path.sep);

export const createWarnings = () => {
    const warnings: string[] = [];
    const warn = (message: string) => {
        warnings.push(message);
        console.warn(message);
    };

    return { warnings, warn };
};

export const ensureDir = async (dir: string, known?: Set<string>) => {
    if (known?.has(dir)) return;

    await fs.mkdir(dir, { recursive: true });
    known?.add(dir);
};

export const stripPrefix = (name: string, prefix: string) => {
    const rest = name.startsWith(prefix) ? name.slice(prefix.length) : name;

    return rest.startsWith("/") ? rest.slice(1) : rest;
};

export interface ResultCollector {
    files: UnpackResult["files"];
    skipped: UnpackResult["skipped"];
    symlinks: UnpackResult["symlinks"];
    warnings: string[];
    warn: (message: string) => void;
}

export const createResultCollector = (): ResultCollector => {
    const { warnings, warn } = createWarnings();

    return { files: [], skipped: [], symlinks: [], warnings, warn };
};

export const createOutputWriter = (
    outputPath: string,
    files: UnpackResult["files"],
    skipped: UnpackResult["skipped"],
    knownDirs?: Set<string>,
) => {
    const written = new Set<string>();

    const writeOut = async (
        name: string,
        data: Buffer,
        kind: FileKind,
    ): Promise<string | null> => {
        const outPath = path.join(outputPath, name);

        if (isOutside(outPath, outputPath)) {
            skipped.push({ path: outPath, reason: "outside output directory" });
            return null;
        }

        if (written.has(outPath)) {
            skipped.push({ path: outPath, reason: "duplicate output path" });
            return null;
        }

        await ensureDir(path.dirname(outPath), knownDirs);
        await fs.writeFile(outPath, data);
        written.add(outPath);

        files.push({ path: outPath, size: data.length, kind });

        return outPath;
    };

    return { writeOut, written };
};

export const writeSymlinkOut = async (
    outputPath: string,
    name: string,
    target: string,
    links: UnpackResult["symlinks"],
    skipped: UnpackResult["skipped"],
    warn: (message: string) => void,
    written?: Set<string>,
    knownDirs?: Set<string>,
): Promise<void> => {
    const outLink = path.join(outputPath, name);

    if (isOutside(outLink, outputPath)) {
        skipped.push({ path: outLink, reason: "outside output directory" });
        return;
    }

    try {
        await ensureDir(path.dirname(outLink), knownDirs);
        await fs.symlink(target, outLink);
        written?.add(outLink);
        links.push({ path: outLink, target });
    } catch {
        warn(`Could not create symlink ${outLink}!`);
        skipped.push({ path: outLink, reason: "symlink failed" });
    }
};

export const applyMode = async (
    targetPath: string,
    mode: number | undefined,
    warn: (message: string) => void,
    display?: string,
): Promise<void> => {
    if (mode === undefined) return;

    try {
        await fs.chmod(targetPath, mode);
    } catch {
        warn(`Could not chmod ${display ?? targetPath}!`);
    }
};

export const gunzip = (
    buf: zlib.InputType,
    options: zlib.ZlibOptions = {},
): Promise<Buffer> => {
    return new Promise<Buffer>((resolve, reject) => {
        zlib.gunzip(buf, options, (err, res) => {
            if (!err) resolve(res);
            else reject(err);
        });
    });
};

export const brotliDecompress = (
    buf: zlib.InputType,
    options: zlib.BrotliOptions = {},
): Promise<Buffer> => {
    return new Promise<Buffer>((resolve, reject) => {
        zlib.brotliDecompress(buf, options, (err, res) => {
            if (!err) resolve(res);
            else reject(err);
        });
    });
};

export const zstdDecompress = (
    buf: zlib.InputType,
    options: zlib.ZstdOptions = {},
): Promise<Buffer> => {
    return new Promise<Buffer>((resolve, reject) => {
        zlib.zstdDecompress(buf, options, (err, res) => {
            if (!err) resolve(res);
            else reject(err);
        });
    });
};

export const parseStatMode = (
    blob: Buffer<ArrayBufferLike>,
): number | undefined => {
    try {
        const stat: unknown = JSON.parse(blob.toString("utf-8"));

        if (
            typeof stat === "object" &&
            stat !== null &&
            "mode" in stat &&
            typeof stat.mode === "number"
        )
            return stat.mode & 0o777;
    } catch {}

    return undefined;
};
