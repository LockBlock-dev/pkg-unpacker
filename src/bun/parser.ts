import {
    BUNFS_PREFIX,
    BUN_MAX_NAME,
    BUN_TABLE_SCAN,
} from "./constants.js";

export interface BunFile {
    name: string;
    data: Buffer;
}

export interface BunArchive {
    entrypoint: string;
    code: Buffer;
    files: BunFile[];
    names: string[];
}

const u32 = (file: Buffer, offset: number) => {
    if (offset + 4 > file.length) throw new Error("out of bounds");

    return file.readUInt32LE(offset);
};

const u64 = (file: Buffer, offset: number) => {
    if (offset + 8 > file.length) throw new Error("out of bounds");

    const value = file.readBigUInt64LE(offset);

    if (value > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("length overflow");

    return Number(value);
};

const readName = (
    file: Buffer,
    offset: number,
): { name: string; length: number } | null => {
    if (offset < 0 || offset >= file.length) return null;

    let end = offset;

    while (end < file.length && file[end] !== 0) {
        if (file[end] as number < 32 || end - offset > BUN_MAX_NAME)
            return null;

        end += 1;
    }

    if (end >= file.length) return null;

    const length = end - offset + 1;
    const name = file.subarray(offset, end).toString("utf-8");

    if (!name.startsWith(BUNFS_PREFIX)) return null;

    return { name, length };
};

const readPool = (
    file: Buffer,
    start: number,
): { names: string[]; end: number } | null => {
    const names: string[] = [];
    let offset = start;

    while (true) {
        if (!file.subarray(offset, offset + BUNFS_PREFIX.length).equals(Buffer.from(BUNFS_PREFIX)))
            break;

        const name = readName(file, offset);

        if (!name) return null;

        names.push(name.name);
        offset += name.length;
    }

    return names.length > 0 ? { names, end: offset } : null;
};

const readEntries = (
    file: Buffer,
    headerEnd: number,
    code: number,
): BunFile[] => {
    const files: BunFile[] = [];
    const end = Math.min(headerEnd + BUN_TABLE_SCAN, file.length - 20);

    for (let offset = headerEnd; offset <= end; offset += 1) {
        const kind = u32(file, offset);
        const nameOff = u32(file, offset + 4);
        const nameLen = u32(file, offset + 8);
        const dataOff = u32(file, offset + 12);
        const dataLen = u32(file, offset + 16);

        if (kind === 0) continue;
        if (nameLen === 0 || nameLen > BUN_MAX_NAME) continue;

        const at = code + nameOff;

        if (at < 0 || at + nameLen > file.length) continue;

        const raw = file.subarray(at, at + nameLen);
        const cut = raw.indexOf(0);
        const text = (cut === -1 ? raw : raw.subarray(0, cut)).toString(
            "utf-8",
        );

        if (!text.startsWith(BUNFS_PREFIX)) continue;
        if (nameLen !== text.length && nameLen !== text.length + 1) continue;
        if (code + dataOff + dataLen > file.length) continue;

        files.push({
            name: text,
            data: Buffer.from(
                file.subarray(code + dataOff, code + dataOff + dataLen),
            ),
        });
    }

    return files;
};

export function findBunArchive(file: Buffer): BunArchive | null {
    let offset = 0;

    while (true) {
        const at = file.indexOf(BUNFS_PREFIX, offset);

        if (at === -1) return null;

        try {
            const pool = readPool(file, at);

            if (pool) {
                const namesOff = u32(file, pool.end);
                const codeLen = u64(file, pool.end + 12);
                const code = at - namesOff;

                if (
                    code >= 0 &&
                    codeLen > 0 &&
                    code + codeLen <= file.length
                ) {
                    const files = readEntries(file, pool.end + 20, code);

                    return {
                        entrypoint: pool.names[0] as string,
                        code: Buffer.from(file.subarray(code, code + codeLen)),
                        files,
                        names: pool.names,
                    };
                }
            }
        } catch {}

        offset = at + 1;
    }
}
