import { platform } from "node:process";

export const C_DISK = "C:";
export const IS_WIN32 = platform === "win32";
export const SEPARATOR = "/";
