import {
    SEA_FLAG_ASSETS,
    SEA_FLAG_CODECACHE,
    SEA_FLAG_SNAPSHOT,
    SEA_MAGIC,
    SEA_MAX_ASSETS,
    SEA_MAX_NAME,
    SEA_TAG_MAIN,
} from "./constants.js";

export interface SeaMain {
    name: string;
    source?: Buffer;
    snapshot: boolean;
}

export interface SeaAsset {
    key: string;
    data: Buffer;
}

export interface SeaBlob {
    main: SeaMain;
    assets: SeaAsset[];
}

class Reader {
    private offset: number;

    constructor(
        private file: Buffer,
        start: number,
    ) {
        this.offset = start;
    }

    get position() {
        return this.offset;
    }

    bytes(length: number) {
        if (
            length < 0 ||
            !Number.isSafeInteger(length) ||
            this.offset + length > this.file.length
        )
            throw new Error("Invalid SEA blob: out of bounds.");

        const slice = this.file.subarray(this.offset, this.offset + length);
        this.offset += length;

        return Buffer.from(slice);
    }

    u8() {
        return this.bytes(1)[0] as number;
    }

    u32() {
        return this.bytes(4).readUInt32LE();
    }

    u64() {
        const value = this.bytes(8).readBigUInt64LE();

        if (value > BigInt(Number.MAX_SAFE_INTEGER))
            throw new Error("Invalid SEA blob: length overflow.");

        return Number(value);
    }

    string() {
        const length = this.u64();

        if (length === 0 || length > SEA_MAX_NAME)
            throw new Error("Invalid SEA blob: bad name length.");

        return this.bytes(length).toString("utf-8");
    }
}

export function parseSeaBlob(file: Buffer, offset: number): SeaBlob {
    const reader = new Reader(file, offset);

    if (!reader.bytes(SEA_MAGIC.length).equals(SEA_MAGIC))
        throw new Error("Invalid SEA blob: bad magic.");

    const flags = reader.u32();

    if (reader.u8() !== SEA_TAG_MAIN)
        throw new Error("Invalid SEA blob: bad main tag.");

    const name = reader.string();
    const main: SeaMain = { name, snapshot: false };

    if (flags & SEA_FLAG_SNAPSHOT) {
        const length = reader.u64();

        if (reader.position + length > file.length)
            throw new Error("Invalid SEA blob: snapshot out of bounds.");

        reader.bytes(length);
        main.snapshot = true;
    } else {
        const length = reader.u64();

        if (reader.position + length > file.length)
            throw new Error("Invalid SEA blob: script out of bounds.");

        main.source = reader.bytes(length);
    }

    if (flags & SEA_FLAG_CODECACHE) {
        const length = reader.u64();

        if (reader.position + length > file.length)
            throw new Error("Invalid SEA blob: cache out of bounds.");

        reader.bytes(length);
    }

    const assets: SeaAsset[] = [];

    if (flags & SEA_FLAG_ASSETS) {
        const count = reader.u64();

        if (count > SEA_MAX_ASSETS)
            throw new Error("Invalid SEA blob: bad asset count.");

        for (let i = 0; i < count; i++) {
            const keyLength = reader.u64();

            if (keyLength === 0 || keyLength > SEA_MAX_NAME)
                throw new Error("Invalid SEA blob: bad asset key.");

            const key = reader.bytes(keyLength).toString("utf-8");
            const valueLength = reader.u64();

            if (reader.position + valueLength > file.length)
                throw new Error("Invalid SEA blob: asset out of bounds.");

            assets.push({ key, data: reader.bytes(valueLength) });
        }
    }

    return { main, assets };
}

export function findSeaBlob(file: Buffer): SeaBlob | null {
    let found: SeaBlob | null = null;
    let offset = 0;

    while (true) {
        const at = file.indexOf(SEA_MAGIC, offset);

        if (at === -1) break;

        try {
            found = parseSeaBlob(file, at);
        } catch {}

        offset = at + 1;
    }

    return found;
}
