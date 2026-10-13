export enum CompressionType {
    NONE,
    GZIP,
    BROTLI,
    ZSTD,
}

export enum StoreType {
    BLOB,
    CONTENT,
    LINKS,
    STAT,
}

export interface Props {
    vfs: Record<string, Record<string, [number, number]>>;
    entryPoint: string;
    symlinks: Record<string, string>;
    filesDict: Record<string, string>;
    doCompress: CompressionType;
}

export type FileKind = "bytecode" | "source" | "asset";

export interface UnpackedFile {
    path: string;
    size: number;
    kind: FileKind;
}

export interface SkippedEntry {
    path: string;
    reason: string;
}

export interface CreatedSymlink {
    path: string;
    target: string;
}

export interface UnpackResult {
    outputDir: string;
    entrypoint: string;
    compression: string;
    files: UnpackedFile[];
    skipped: SkippedEntry[];
    symlinks: CreatedSymlink[];
    warnings: string[];
}

export interface UnpackOptions {
    json?: boolean;
}
