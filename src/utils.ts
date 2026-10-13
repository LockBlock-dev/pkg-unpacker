import zlib from "node:zlib";

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
