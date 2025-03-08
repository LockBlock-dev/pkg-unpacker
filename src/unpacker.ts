import { existsSync } from "node:fs";
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import { Script } from "node:vm";

import { C_DISK, IS_WIN32, SEPARATOR } from "./constants";
import { UnpackerReadError } from "./errors";
import { CompressionType, StoreType, type Props } from "./types";
import { gunzip, brotliDecompress } from "./utils";

const EMPTY_PROPS: Props = {
    vfs: {},
    entryPoint: "",
    symlinks: {},
    filesDict: {},
    doCompress: CompressionType.NONE,
};

const propsMapping: { [K in keyof Props]: (prop: string) => Props[K] } = {
    vfs: JSON.parse,
    entryPoint: (prop: string) => prop.replaceAll(`"`, ""),
    symlinks: JSON.parse,
    filesDict: JSON.parse,
    doCompress: Number,
};

class Unpacker {
    private filePath: string;
    private payloadPosition: number;
    private symlinksEntries: Array<[string, string]>;
    private separator: string;
    private dictRev: Record<string, string>;
    private maxKey: number;
    private props: Props;

    static async create(filePath: string) {
        const binary = await fs.readFile(filePath, { encoding: "utf-8" });
        let rawProps = binary.match(
            /\{.*}\n,\n".*"\n,\n\{.*}\n,\n\{.*}\n,\n([012])/g,
        );

        if (!rawProps || !rawProps.length)
            throw new UnpackerReadError(
                "Error while reading the binary props!",
            );

        const props = Unpacker.initProps(rawProps[0].split("\n,\n"));
        const file = await fs.readFile(filePath);
        const idx = file.indexOf(Buffer.from("var PAYLOAD_POSITION = "));

        if (idx === -1)
            throw new UnpackerReadError("Cannot find the pkg payload!");

        let payload = file.subarray(idx);
        payload = payload.subarray(0, payload.indexOf(Buffer.from("\n")));

        const payloadPosition = Number(
            payload.toString().match(/\d+/)?.[0] ?? -1,
        );

        if (payloadPosition === -1)
            throw new UnpackerReadError("Cannot find the pkg payload!");

        return new Unpacker(filePath, props, payloadPosition);
    }

    private static initProps(rawProps: string[]) {
        if (rawProps.length < Object.keys(propsMapping).length) {
            throw new UnpackerReadError("Missing required props!");
        }

        return Object.entries(propsMapping).reduce<Props>(
            (result, [key, transform], idx) => {
                try {
                    //@ts-expect-error TypeScript issue
                    result[key] = transform(rawProps[idx]);
                } catch {
                    throw new UnpackerReadError(
                        `Error parsing ${key} at index ${idx}.`,
                    );
                }

                return result;
            },
            { ...EMPTY_PROPS },
        );
    }

    constructor(filePath: string, props: Props, payloadPosition: number) {
        this.filePath = filePath;
        this.payloadPosition = payloadPosition;
        this.props = props;
        this.symlinksEntries = Object.entries(props.symlinks);
        this.separator = props.doCompress ? SEPARATOR : path.sep;
        this.dictRev = {};
        this.maxKey = Object.values(props.filesDict).length;

        Object.entries(props.filesDict).forEach(([k, v]) => {
            this.dictRev[v] = k;
        });
    }

    private uppercaseDriveLetter(f: string) {
        if (f.slice(1, 3) !== ":\\") return f;

        return f[0].toUpperCase() + f.slice(1);
    }

    private removeTrailingSlashes(f: string) {
        if (f === "/") return f; // don't remove from "/"

        if (f.slice(1) === ":\\") return f; // don't remove from "D:\"

        let last = f.length - 1;

        while (true) {
            const char = f.charAt(last);

            if (char === "\\") {
                f = f.slice(0, -1);
                last -= 1;
            } else if (char === "/") {
                f = f.slice(0, -1);
                last -= 1;
            } else break;
        }

        return f;
    }

    private isUrl(p: unknown): p is URL {
        return typeof URL !== "undefined" && p instanceof URL;
    }

    private pathToString(p: string) {
        let result = p;

        if (Buffer.isBuffer(p)) result = p.toString();
        else if (this.isUrl(p))
            result = IS_WIN32 ? p.pathname.replace(/^\//, "") : p.pathname;

        return result;
    }

    private normalizePath(f: string) {
        let file = this.pathToString(f);

        if (!/^.:$/.test(file)) file = path.normalize(file); // 'c:' -> 'c:.'

        if (IS_WIN32) file = this.uppercaseDriveLetter(file);

        return this.removeTrailingSlashes(file);
    }

    private replace(k: string) {
        let v = this.props.filesDict[k];
        // we have found a part of a missing file => let record for latter use
        if (v === undefined) {
            this.maxKey += 1;
            v = this.maxKey.toString(36);
            this.props.filesDict[k] = v;
            this.dictRev[v] = k;
        }

        return v;
    }

    private findVirtualFileSystemKey(path_: string, slash: typeof path.sep) {
        const normalizedPath = this.normalizePath(path_);

        if (!this.props.doCompress) return normalizedPath;

        const a = normalizedPath
            .split(slash)
            .map((p) => this.replace(p))
            .join(SEPARATOR);

        return a || normalizedPath;
    }

    private toOriginal(fShort: string) {
        if (!this.props.doCompress) return fShort;

        return fShort
            .split(SEPARATOR)
            .map((x) => this.dictRev[x])
            .join(path.sep);
    }

    private findVirtualFileSystemKeyAndFollowLinks(path_: string) {
        let vfsKey = this.findVirtualFileSystemKey(path_, path.sep);
        let needToSubstitute = true;

        while (needToSubstitute) {
            needToSubstitute = false;

            for (const [k, v] of this.symlinksEntries) {
                if (
                    vfsKey.startsWith(`${k}${this.separator}`) ||
                    vfsKey === k
                ) {
                    vfsKey = vfsKey.replace(k, v);
                    needToSubstitute = true;

                    break;
                }
            }
        }

        return vfsKey;
    }

    private findVirtualFileSystemEntry(path_: string) {
        const vfsKey = this.findVirtualFileSystemKeyAndFollowLinks(path_);

        return this.props.vfs[vfsKey];
    }

    private reverseLinks(path_: string) {
        let needToSubstitute = true;

        while (needToSubstitute) {
            needToSubstitute = false;

            for (const [k, v] of this.symlinksEntries) {
                if (path_.startsWith(`${v}${this.separator}`) || path_ === v) {
                    path_ = path_.replace(v, k);
                    needToSubstitute = true;
                    break;
                }
            }
        }

        return path_;
    }

    private async readFile(fd: FileHandle, [startPos, size]: [number, number]) {
        let buf = Buffer.alloc(size);

        const { bytesRead } = await fd.read({
            buffer: buf,
            offset: 0,
            length: size,
            position: this.payloadPosition + startPos,
        });

        if (bytesRead === 0)
            // throw new UnpackerReadError("Read 0 bytes from file!");
            return null;

        try {
            if (this.props.doCompress === CompressionType.GZIP)
                return await gunzip(buf);
            else if (this.props.doCompress === CompressionType.BROTLI)
                return await brotliDecompress(buf);
        } catch {}

        return buf;
    }

    private async writeFile(path_: string, blob: Buffer<ArrayBufferLike>) {
        const dir = path.dirname(path_);

        if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(path_, blob);
    }

    private executeEntrypoint(blob: Buffer<ArrayBufferLike>) {
        const options = {
            lineOffset: 0,
            displayErrors: true,
            cachedData: blob,
            sourceless: true,
        };
        const script = new Script("", options);
        const wrapper = script.runInThisContext();

        if (!wrapper)
            throw new Error(
                `Internal JavaScript Evaluation Failure (for example VERSION_MISMATCH). Cannot execute the code!`,
            );

        try {
            wrapper();
        } catch (e) {
            throw new Error(
                `Error while executing the code! Got the following error:\n${
                    e instanceof Error ? e.toString() : e
                }`,
            );
        }
    }

    public async unpack(
        outputFolder: string = ".",
        shouldRun: boolean = false,
    ) {
        console.log(
            `Detected compression: ${CompressionType[this.props.doCompress]}`,
        );
        console.log(`Detected entrypoint: ${this.props.entryPoint}`);
        console.log(
            `Unpacking your binary, ${
                Object.keys(this.props.vfs).length
            } elements to go...`,
        );

        let entrypointExecuted = false;
        const outputPath = path.resolve(outputFolder);
        const fd = await fs.open(this.filePath, "r");

        for (let path_ in this.props.vfs) {
            if (this.props.doCompress)
                path_ = this.toOriginal(this.reverseLinks(path_));

            const vfsEntry = this.findVirtualFileSystemEntry(path_);

            if (
                !(StoreType.BLOB.toString() in vfsEntry) &&
                !(StoreType.CONTENT.toString() in vfsEntry)
            )
                // Ignore directories and file info
                continue;

            let blob = await this.readFile(
                fd,
                // Prefer text content over blob
                vfsEntry[StoreType.CONTENT.toString()] ||
                    vfsEntry[StoreType.BLOB.toString()],
            );

            if (!blob) {
                console.warn(`Could not read file with VFS path of ${path_}!`);
                continue;
            }

            if (shouldRun && path_ === this.props.entryPoint) {
                try {
                    this.executeEntrypoint(blob);
                    entrypointExecuted = true;
                } catch (e) {
                    console.error(
                        `Entrypoint execution failed! ${
                            e instanceof Error ? e.toString() : e
                        }`,
                    );
                }
            }

            path_ = path.join(outputPath, path_.replace(C_DISK, ""));

            await this.writeFile(path_, blob);
        }

        console.log(`Binary unpacked to ${outputFolder}!`);

        if (shouldRun && !entrypointExecuted)
            console.warn(
                "The binary has not been executed! It may be because the entrypoint could not be found.",
            );
    }
}

export default Unpacker;
