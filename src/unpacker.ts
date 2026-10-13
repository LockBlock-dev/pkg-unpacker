import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import { Script } from "node:vm";

import {
    C_DISK,
    IS_WIN32,
    SEPARATOR,
    RAW_PROPS_REGEX,
    OLD_SEPARATOR,
    PAYLOAD_MARKER,
    PROPS_SCAN_WINDOW,
} from "./constants.js";
import { UnpackerReadError } from "./errors.js";
import { CompressionType, StoreType, type Props } from "./types.js";
import { gunzip, brotliDecompress, zstdDecompress, isBun, parseStatMode } from "./utils.js";

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
    private nativeSeparator: typeof path.sep;
    private dictRev: Record<string, string>;
    private symlinkLinks = new Map<string, string>();
    private maxKey: number;
    private props: Props;

    static async create(filePath: string) {
        const handle = await fs.open(filePath, "r");

        try {
            const { size } = await handle.stat();

            let windowSize = Math.min(size, PROPS_SCAN_WINDOW);
            let tail = Buffer.alloc(0);
            let rawProps: RegExpMatchArray | null = null;

            while (true) {
                tail = Buffer.alloc(windowSize);
                await handle.read({
                    buffer: tail,
                    offset: 0,
                    length: windowSize,
                    position: size - windowSize,
                });

                rawProps = tail.toString("utf-8").match(RAW_PROPS_REGEX);

                if (rawProps?.length || windowSize >= size) break;

                windowSize = Math.min(size, windowSize * 2);
            }

            if (!rawProps?.length || !rawProps[0])
                throw new UnpackerReadError(
                    "Error while reading the binary props!",
                );

            const props = Unpacker.initProps(rawProps[0].split("\n,\n"));

            if (
                props.doCompress !== CompressionType.NONE &&
                props.doCompress !== CompressionType.GZIP &&
                props.doCompress !== CompressionType.BROTLI &&
                props.doCompress !== CompressionType.ZSTD
            )
                throw new UnpackerReadError(
                    `Unsupported compression: ${props.doCompress}.`,
                );

            let markerIdx = tail.indexOf(PAYLOAD_MARKER);
            let file: Buffer;

            if (markerIdx === -1) {
                file = await handle.readFile();
                markerIdx = file.indexOf(PAYLOAD_MARKER);
            } else {
                file = tail;
            }

            if (markerIdx === -1)
                throw new UnpackerReadError("Cannot find the pkg payload!");

            const lineEnd = file.indexOf("\n", markerIdx);
            const payload = file.subarray(
                markerIdx,
                lineEnd === -1 ? undefined : lineEnd,
            );

            let payloadPosition = Number(
                payload.toString().match(/\d+/)?.[0] ?? -1,
            );

            if (payloadPosition <= 0)
                payloadPosition = await Unpacker.discoverPayloadPosition(
                    handle,
                    props,
                );

            if (payloadPosition <= 0)
                throw new UnpackerReadError("Cannot find the pkg payload!");

            return new Unpacker(filePath, props, payloadPosition);
        } finally {
            await handle.close();
        }
    }

    private static initProps(rawProps: string[]) {
        // Account for older versions without filesDict and doCompress
        if (rawProps.length < Object.keys(propsMapping).length - 2)
            throw new UnpackerReadError("Missing required props!");

        const transforms = Object.entries(propsMapping) as Array<
            [keyof Props, (prop: string) => Props[keyof Props]]
        >;

        return rawProps.reduce<Props>(
            (result, rawProp, idx) => {
                const entry = transforms[idx];

                if (!entry)
                    throw new UnpackerReadError(
                        `Missing transform at index ${idx}.`,
                    );

                const [key, transform] = entry;

                try {
                    (result as unknown as Record<string, unknown>)[key] =
                        transform(rawProp);
                } catch {
                    throw new UnpackerReadError(
                        `Error parsing ${key} at index ${idx}.`,
                    );
                }

                return result;
            },
            {
                ...EMPTY_PROPS,
            },
        );
    }

    private static async discoverPayloadPosition(
        fd: FileHandle,
        props: Props,
    ) {
        const { size } = await fd.stat();
        const file = Buffer.alloc(size);

        await fd.read({ buffer: file, offset: 0, length: size, position: 0 });

        const candidates = new Set<number>();
        const pattern = /[0-9]{5,10} {2,}/g;
        const text = file.toString("latin1");
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(text)) !== null) {
            const digits = match[0]?.trim();
            if (digits !== undefined) candidates.add(Number(digits));
        }

        for (const candidate of candidates) {
            for (const entry of Object.values(props.vfs)) {
                const range = entry[StoreType.STAT.toString()];
                if (!range) continue;

                try {
                    const raw = file.subarray(
                        candidate + range[0],
                        candidate + range[0] + range[1],
                    );

                    let text: string;

                    if (props.doCompress === CompressionType.GZIP)
                        text = (await gunzip(raw)).toString("utf-8");
                    else if (props.doCompress === CompressionType.BROTLI)
                        text = (await brotliDecompress(raw)).toString("utf-8");
                    else if (props.doCompress === CompressionType.ZSTD)
                        text = (await zstdDecompress(raw)).toString("utf-8");
                    else text = raw.toString("utf-8");

                    JSON.parse(text);

                    return candidate;
                } catch {}
            }
        }

        return -1;
    }

    constructor(filePath: string, props: Props, payloadPosition: number) {
        this.filePath = filePath;
        this.payloadPosition = payloadPosition;
        this.props = props;
        this.symlinksEntries = Object.entries(props.symlinks);
        this.dictRev = {};
        this.maxKey = Object.values(props.filesDict).length;

        let [firstEntry] = Object.keys(this.props.vfs);

        if (firstEntry?.includes(OLD_SEPARATOR)) this.separator = OLD_SEPARATOR;
        else this.separator = props.doCompress ? SEPARATOR : path.sep;

        this.nativeSeparator = this.props.entryPoint.includes(C_DISK)
            ? "\\"
            : "/";

        Object.entries(props.filesDict).forEach(([k, v]) => {
            this.dictRev[v] = k;
        });

        for (const [link, target] of this.symlinksEntries)
            this.symlinkLinks.set(this.toOriginal(link), this.toOriginal(target));
    }

    private uppercaseDriveLetter(f: string) {
        if (f.slice(1, 3) !== ":\\") return f;

        return f.charAt(0).toUpperCase() + f.slice(1);
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

    private normalizePath(f: string) {
        let file = f;

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
            .join(this.separator);

        return a || normalizedPath;
    }

    private toOriginal(fShort: string) {
        if (!this.props.doCompress && this.separator !== OLD_SEPARATOR)
            return fShort;

        return fShort
            .split(this.separator)
            .map((x) => this.dictRev[x] ?? x)
            .join(this.nativeSeparator);
    }

    private findVirtualFileSystemKeyAndFollowLinks(path_: string) {
        let vfsKey = this.findVirtualFileSystemKey(path_, this.nativeSeparator);
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

    private remapSymlinkTarget(target: string, outputPath: string) {
        if (
            target.startsWith("/snapshot/") ||
            /^[A-Za-z]:\\snapshot\\/i.test(target)
        )
            return path.join(outputPath, target.replace(C_DISK, ""));

        return target;
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
            else if (this.props.doCompress === CompressionType.ZSTD)
                return await zstdDecompress(buf);
        } catch (e) {
            console.debug(
                `Decompression failed, using raw bytes: ${
                    e instanceof Error ? e.message : e
                }`,
            );
        }

        return buf;
    }

    private createdDirs = new Set<string>();

    private async ensureDir(dir: string) {
        if (!this.createdDirs.has(dir)) {
            await fs.mkdir(dir, { recursive: true });
            this.createdDirs.add(dir);
        }
    }

    private async writeFile(path_: string, blob: Buffer<ArrayBufferLike>) {
        await this.ensureDir(path.dirname(path_));

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

        if (script.cachedDataRejected)
            throw new Error(
                `Entrypoint bytecode was built for a different Node.js version than ${process.version}: V8 rejected the cached data. Cannot execute the code!`,
            );

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
        if (shouldRun && isBun())
            throw new Error(
                "--run is not supported under Bun: the entrypoint is V8 bytecode and Bun runs JavaScriptCore.",
            );

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

        try {
            const jobs: Array<{
                vfsPath: string;
                outPath: string;
                range: [number, number];
                statRange?: [number, number];
            }> = [];
            const dirJobs: Array<{
                outPath: string;
                statRange?: [number, number];
            }> = [];
            const symlinkJobs: Array<{
                outLink: string;
                outTarget: string;
            }> = [];

            for (let path_ in this.props.vfs) {
                if (this.props.doCompress)
                    path_ = this.toOriginal(
                        this.reverseLinks(
                            this.separator === OLD_SEPARATOR
                                ? this.normalizePath(path_)
                                : path_,
                        ),
                    );

                const vfsEntry = this.findVirtualFileSystemEntry(path_);

                if (!this.props.doCompress && this.separator === OLD_SEPARATOR)
                    path_ = this.toOriginal(
                        this.reverseLinks(this.normalizePath(path_)),
                    );

                if (!vfsEntry) continue;

                const symlinkTarget = this.symlinkLinks.get(path_);

                if (symlinkTarget !== undefined) {
                    symlinkJobs.push({
                        outLink: path.join(
                            outputPath,
                            path_.replace(C_DISK, ""),
                        ),
                        outTarget: this.remapSymlinkTarget(
                            symlinkTarget,
                            outputPath,
                        ),
                    });

                    continue;
                }

                const outPath = path.join(
                    outputPath,
                    path_.replace(C_DISK, ""),
                );
                const statRange = vfsEntry[StoreType.STAT.toString()];

                if (
                    !(StoreType.BLOB.toString() in vfsEntry) &&
                    !(StoreType.CONTENT.toString() in vfsEntry)
                ) {
                    if (
                        StoreType.LINKS.toString() in vfsEntry ||
                        StoreType.STAT.toString() in vfsEntry
                    )
                        dirJobs.push({ outPath, statRange });

                    continue;
                }

                const range =
                    vfsEntry[StoreType.CONTENT.toString()] ||
                    vfsEntry[StoreType.BLOB.toString()];

                if (!range) continue;

                jobs.push({ vfsPath: path_, outPath, range, statRange });
            }

            const CHUNK_SIZE = 8;

            for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
                await Promise.all(
                    jobs.slice(i, i + CHUNK_SIZE).map(async (job) => {
                        const blob = await this.readFile(fd, job.range);

                        if (!blob) {
                            console.warn(
                                `Could not read file with VFS path of ${job.vfsPath}!`,
                            );
                            return;
                        }

                        if (
                            shouldRun &&
                            job.vfsPath === this.props.entryPoint
                        ) {
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

                        await this.writeFile(job.outPath, blob);

                        if (job.statRange) {
                            const statBlob = await this.readFile(
                                fd,
                                job.statRange,
                            );
                            const mode = statBlob && parseStatMode(statBlob);

                            if (typeof mode === "number") {
                                try {
                                    await fs.chmod(job.outPath, mode);
                                } catch {
                                    console.warn(
                                        `Could not chmod ${job.outPath}!`,
                                    );
                                }
                            }
                        }
                    }),
                );
            }

            for (const dir of dirJobs) {
                await this.ensureDir(dir.outPath);

                if (dir.statRange) {
                    const statBlob = await this.readFile(fd, dir.statRange);
                    const mode = statBlob && parseStatMode(statBlob);

                    if (typeof mode === "number") {
                        try {
                            await fs.chmod(dir.outPath, mode);
                        } catch {
                            console.warn(`Could not chmod ${dir.outPath}!`);
                        }
                    }
                }
            }

            for (const link of symlinkJobs) {
                try {
                    await this.ensureDir(path.dirname(link.outLink));
                    await fs.symlink(link.outTarget, link.outLink);
                } catch {
                    console.warn(`Could not create symlink ${link.outLink}!`);
                }
            }
        } finally {
            await fd.close();
        }

        console.log(`Binary unpacked to ${outputFolder}!`);

        if (shouldRun && !entrypointExecuted)
            console.warn(
                "The binary has not been executed! See the error above.",
            );
    }
}

export default Unpacker;
