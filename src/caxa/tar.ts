export type TarEntryType = "file" | "dir" | "symlink";

export interface TarEntry {
    name: string;
    mode: number;
    size: number;
    type: TarEntryType;
    link?: string;
    data: Buffer;
}

const parseOctal = (bytes: Buffer) => {
    const text = bytes
        .toString("ascii")
        .replaceAll("\0", "")
        .trim();

    if (!/^[0-7]+$/.test(text)) throw new Error("bad number");

    return parseInt(text, 8);
};

const parseString = (bytes: Buffer) => {
    const end = bytes.indexOf(0);

    return (end === -1 ? bytes : bytes.subarray(0, end)).toString("utf-8");
};

export function parseTar(data: Buffer): TarEntry[] {
    const entries: TarEntry[] = [];
    let offset = 0;
    let longName: string | null = null;

    while (offset + 512 <= data.length) {
        const header = data.subarray(offset, offset + 512);

        if (header.every((byte) => byte === 0)) break;

        let checksum = 0;

        for (let i = 0; i < 148; i++) checksum += header[i] as number;
        for (let i = 0; i < 8; i++) checksum += 32;
        for (let i = 156; i < 512; i++) checksum += header[i] as number;

        if (checksum !== parseOctal(header.subarray(148, 156)))
            throw new Error("Invalid caxa archive: bad tar checksum.");

        const type = String.fromCharCode(header[156] as number);
        const size = parseOctal(header.subarray(124, 136));
        const dataStart = offset + 512;
        const dataEnd = dataStart + Math.ceil(size / 512) * 512;

        if (dataEnd > data.length)
            throw new Error("Invalid caxa archive: truncated entry.");

        if (type === "L" || type === "K") {
            longName = data.subarray(dataStart, dataStart + size).toString("utf-8").replaceAll("\0", "");
        } else {
            let name = parseString(header.subarray(0, 100));
            const prefix = parseString(header.subarray(345, 500));

            if (prefix) name = `${prefix}/${name}`;
            if (longName) {
                name = longName;
                longName = null;
            }

            if (type === "5" || name.endsWith("/")) {
                entries.push({
                    name,
                    mode: parseOctal(header.subarray(100, 108)) & 0o777,
                    size: 0,
                    type: "dir",
                    data: Buffer.alloc(0),
                });
            } else if (type === "2") {
                entries.push({
                    name,
                    mode: parseOctal(header.subarray(100, 108)) & 0o777,
                    size: 0,
                    type: "symlink",
                    link: parseString(header.subarray(157, 257)),
                    data: Buffer.alloc(0),
                });
            } else if (type === "0" || type === "\0") {
                entries.push({
                    name,
                    mode: parseOctal(header.subarray(100, 108)) & 0o777,
                    size,
                    type: "file",
                    data: Buffer.from(data.subarray(dataStart, dataStart + size)),
                });
            }
        }

        offset = dataEnd;
    }

    return entries;
}
