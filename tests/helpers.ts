import { deflateRawSync, gzipSync } from "node:zlib";

export interface TestArchiveFile {
    name: string;
    data: Buffer;
}

export const buildTestArchive = (opts: {
    bundle?: { name: string; code: Buffer };
    files?: TestArchiveFile[];
}) => {
    const code = opts.bundle?.code ?? Buffer.alloc(0);
    const files = opts.files ?? [];
    const parts: Buffer[] = [code];
    const contentOffsets: number[] = [];
    let position = code.length;

    for (const file of files) {
        contentOffsets.push(position);
        parts.push(file.data);
        position += file.data.length;
    }

    const names = [
        ...(opts.bundle ? [opts.bundle.name] : []),
        ...files.map((file) => file.name),
    ];
    const nameOffsets: number[] = [];
    const poolStart = position;

    for (const name of names) {
        nameOffsets.push(position);
        const encoded = Buffer.from(`${name}\0`);
        parts.push(encoded);
        position += encoded.length;
    }

    const header = Buffer.alloc(20);
    header.writeUInt32LE(poolStart, 0);
    header.writeBigUInt64LE(BigInt(0), 4);
    header.writeBigUInt64LE(BigInt(code.length), 12);
    parts.push(header);
    position += header.length;

    const table: Buffer[] = [];

    for (const [index, file] of files.entries()) {
        const entry = Buffer.alloc(52);
        entry.writeUInt32LE(0x10101, 0);
        entry.writeUInt32LE(nameOffsets[index + (opts.bundle ? 1 : 0)] as number, 4);
        entry.writeUInt32LE(Buffer.byteLength(file.name) + 1, 8);
        entry.writeUInt32LE(contentOffsets[index] as number, 12);
        entry.writeUInt32LE(file.data.length, 16);
        table.push(entry);
    }

    return Buffer.concat([...parts, ...table]);
};

export interface TestTarEntry {
    name: string;
    content: Buffer;
    mode: number;
    symlink?: string;
}

const octal = (value: number, length: number) =>
    value.toString(8).padStart(length - 1, "0") + "\0";

export const buildTestTar = (entries: TestTarEntry[]) => {
    const parts: Buffer[] = [];

    for (const entry of entries) {
        if (
            Buffer.byteLength(entry.name) >= 100 ||
            (entry.symlink && Buffer.byteLength(entry.symlink) >= 100)
        )
            throw new Error("test helper: name too long");

        const header = Buffer.alloc(512);
        header.write(entry.name, 0);
        header.write(octal(entry.mode, 8), 100);
        header.write(octal(entry.content.length, 12), 124);
        header.write(entry.symlink ? "2" : entry.name.endsWith("/") ? "5" : "0", 156);
        header.write("ustar  \0", 257);

        if (entry.symlink) header.write(entry.symlink, 157);

        let checksum = 0;

        for (let i = 0; i < 148; i++) checksum += header[i] as number;
        for (let i = 0; i < 8; i++) checksum += 32;
        for (let i = 156; i < 512; i++) checksum += header[i] as number;

        header.write(octal(checksum, 8), 148);
        parts.push(header);

        if (!entry.symlink && entry.content.length > 0) {
            parts.push(
                Buffer.concat([
                    entry.content,
                    Buffer.alloc((512 - (entry.content.length % 512)) % 512),
                ]),
            );
        }
    }

    return Buffer.concat(parts);
};

export const buildCaxaFrame = (tar: Buffer) => {
    const footer = Buffer.from(
        '\n{"identifier":"test/hello","command":["{{caxa}}/node_modules/.bin/node","{{caxa}}/index.js"]}',
    );

    return Buffer.concat([
        Buffer.from("STUBJUNK"),
        Buffer.from("CAXACAXACAXA"),
        Buffer.from("\n"),
        gzipSync(tar),
        footer,
    ]);
};

export interface TestZipEntry {
    name: string;
    content: Buffer;
    mode?: number;
    deflated?: boolean;
}

export const buildTestZip = (entries: TestZipEntry[]) => {
    const chunks: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name);
        const mode = entry.mode ?? 0o644;
        const raw = entry.deflated
            ? deflateRawSync(entry.content)
            : entry.content;

        const local = Buffer.alloc(30);
        local.write("PK\x03\x04", 0);
        local.writeUInt16LE(entry.deflated ? 8 : 0, 8);
        local.writeUInt32LE(raw.length, 18);
        local.writeUInt32LE(entry.content.length, 22);
        local.writeUInt16LE(name.length, 26);
        chunks.push(local, name, raw);

        const record = Buffer.alloc(46);
        record.write("PK\x01\x02", 0);
        record.writeUInt16LE(entry.deflated ? 8 : 0, 10);
        record.writeUInt32LE(raw.length, 20);
        record.writeUInt32LE(entry.content.length, 24);
        record.writeUInt16LE(name.length, 28);
        record.writeUInt32LE((mode << 16) >>> 0, 38);
        record.writeUInt32LE(offset, 42);
        central.push(record, name);

        offset += 30 + name.length + raw.length;
    }

    const centralDir = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.write("PK\x05\x06", 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDir.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...chunks, centralDir, end]);
};

export const buildNexeFrame = (zip: Buffer) => {
    const content = Buffer.from("NEXERUNTIME");
    const sizes = Buffer.alloc(16);
    sizes.writeDoubleLE(content.length, 0);
    sizes.writeDoubleLE(zip.length, 8);

    return Buffer.concat([
        Buffer.from("JUNKJUNK"),
        content,
        zip,
        Buffer.from("<nexe~~sentinel>"),
        sizes,
    ]);
};
