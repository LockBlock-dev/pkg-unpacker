import { platform } from "node:process";

export const C_DISK = "C:";
export const IS_WIN32 = platform === "win32";
// 5.2.0 separator
export const OLD_SEPARATOR = "$";
export const SEPARATOR = "/";

export const RAW_PROPS_REGEX = new RegExp(
    /\{.*}\n,\n".*"\n,\n\{.*}(?:\n,\n\{.*}\n,\n(\d))?/g,
);

// Marker of the payload offset line in pkg binaries.
export const PAYLOAD_MARKER = "var PAYLOAD_POSITION = ";

// Initial tail window for the props scan; doubled until matched.
export const PROPS_SCAN_WINDOW = 4 * 1024 * 1024;
