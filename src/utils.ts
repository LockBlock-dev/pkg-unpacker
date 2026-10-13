import zlib from "node:zlib";

export const isBun = (): boolean => "bun" in process.versions;

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
