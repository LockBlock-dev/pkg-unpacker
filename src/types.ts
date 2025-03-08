export enum CompressionType {
    NONE,
    GZIP,
    BROTLI,
}

export enum StoreType {
    BLOB,
    CONTENT,
    DIRECTORY,
    FILE_INFO,
}

export interface Props {
    vfs: Record<string, Record<string, [number, number]>>;
    entryPoint: string;
    symlinks: Record<string, string>;
    filesDict: Record<string, string>;
    doCompress: CompressionType;
}
