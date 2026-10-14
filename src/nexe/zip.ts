import zlib from "node:zlib";

export type ZipEntryType = "file" | "dir" | "symlink";

export interface ZipEntry {
    name: string;
    mode: number;
    type: ZipEntryType;
    link?: string;
    data: Buffer;
}

const parseString = (bytes: Buffer) => {
    const end = bytes.indexOf(0);

    return (end === -1 ? bytes : bytes.subarray(0, end)).toString("utf-8");
};

export function parseZip(data: Buffer): ZipEntry[] {
    const end = data.lastIndexOf(Buffer.from("PK\x05\x06"));

    if (end === -1)
        throw new Error("Invalid nexe archive: no end of central directory.");

    const count = data.readUInt16LE(end + 10);
    let offset = data.readUInt32LE(end + 16);
    const entries: ZipEntry[] = [];

    for (let i = 0; i < count; i++) {
        if (
            offset + 46 > data.length ||
            data.subarray(offset, offset + 4).toString("binary") !== "PK\x01\x02"
        )
            throw new Error("Invalid nexe archive: bad central directory.");

        const method = data.readUInt16LE(offset + 10);
        const compSize = data.readUInt32LE(offset + 20);
        const nameLen = data.readUInt16LE(offset + 28);
        const extraLen = data.readUInt16LE(offset + 30);
        const commentLen = data.readUInt16LE(offset + 32);
        const mode = data.readUInt32LE(offset + 38) >>> 16;
        const localOff = data.readUInt32LE(offset + 42);
        const name = data
            .subarray(offset + 46, offset + 46 + nameLen)
            .toString("utf-8");

        if (localOff + 30 > data.length)
            throw new Error("Invalid nexe archive: bad local header.");

        const localNameLen = data.readUInt16LE(localOff + 26);
        const localExtraLen = data.readUInt16LE(localOff + 28);
        const dataStart = localOff + 30 + localNameLen + localExtraLen;

        if (dataStart + compSize > data.length)
            throw new Error("Invalid nexe archive: truncated entry.");

        const raw = Buffer.from(
            data.subarray(dataStart, dataStart + compSize),
        );
        const content =
            method === 0
                ? raw
                : method === 8
                  ? zlib.inflateRawSync(raw)
                  : (() => {
                        throw new Error(
                            "Invalid nexe archive: unsupported compression.",
                        );
                    })();

        const fileType = mode & 0o170000;

        if (name.endsWith("/") || fileType === 0o040000) {
            entries.push({
                name: name.replace(/\/$/, ""),
                mode: mode & 0o777,
                type: "dir",
                data: Buffer.alloc(0),
            });
        } else if (fileType === 0o120000) {
            entries.push({
                name,
                mode: mode & 0o777,
                type: "symlink",
                link: content.toString("utf-8"),
                data: Buffer.alloc(0),
            });
        } else {
            entries.push({
                name,
                mode: mode & 0o777,
                type: "file",
                data: content,
            });
        }

        offset += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
}
