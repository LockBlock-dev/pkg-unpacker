const fs = require("fs");
const path = require("path");
const { Script } = require("vm");
const { gunzipSync, brotliDecompressSync } = require("zlib");

const READ_ERR = "This might happen if your binary is not readable or if pkg changed their code.";

const initProps = (props) => {
    let propObj = {
        vfs: {},
        entryPoint: "",
        symlinks: {},
        filesDict: {},
        doCompress: 0,
    };

    for (let idx = 0; idx < props.length; idx++) {
        let prop = "";

        try {
            switch (idx) {
                case 0:
                    prop = "vfs";
                    propObj.vfs = JSON.parse(props[idx]);
                    break;
                case 1:
                    prop = "entryPoint";
                    propObj.entryPoint = props[idx].replaceAll(`"`, "");
                    break;
                case 2:
                    prop = "symlinks";
                    propObj.symlinks = JSON.parse(props[idx]);
                    break;
                case 3:
                    prop = "filesDict";
                    propObj.filesDict = JSON.parse(props[idx]);
                    break;
                case 4:
                    prop = "doCompress";
                    propObj.doCompress = Number(props[idx]);
                    break;
            }
        } catch (e) {
            throw new Error(
                `Error while parsing the binary props! ${READ_ERR}\nParsing ${prop} at index ${idx}`
            );
        }
    }

    return propObj;
};

const argv = require("minimist")(process.argv.slice(2));

if (!argv.i || !argv.o)
    throw new Error("You need to provide an input file and an output directory!");

const binary = fs.readFileSync(argv.i, { encoding: "utf-8" });
let rawProps = binary.match(/\{.*}\n,\n".*"\n,\n\{.*}\n,\n\{.*}\n,\n([012])/g);

try {
    rawProps = rawProps[0].split("\n,\n");
} catch (e) {
    throw new Error(`Error while reading the binary props! ${READ_ERR}`);
}

const props = initProps(rawProps);

const GZIP = 1;
const BROTLI = 2;
const DOCOMPRESS = props.doCompress;
const DICT = props.filesDict;
const VIRTUAL_FILESYSTEM = props.vfs;
const SYMLINKS = props.symlinks;

const file = fs.readFileSync(argv.i);
const idx = file.indexOf(Buffer.from("var PAYLOAD_POSITION = "));

if (idx === -1) throw new Error(`Cannot find the pkg payload! ${READ_ERR}`);

let payload = file.slice(idx);
payload = payload.slice(0, payload.indexOf(Buffer.from("\n")));

const PAYLOAD_POSITION = Number(payload.toString().match(/\d+/)[0]);

// /////////////////////////////////////////////////////////////////
// PKG CODE https://github.com/vercel/pkg //////////////////////////
// /////////////////////////////////////////////////////////////////

const win32 = process.platform === "win32";
const hasURL = typeof URL !== "undefined";
const symlinksEntries = Object.entries(SYMLINKS);
const separator = "/";
// separator for substitution depends on platform;
const sepsep = DOCOMPRESS ? separator : path.sep;
const dictRev = {};
let maxKey = Object.values(DICT).length;

Object.entries(DICT).forEach(([k, v]) => {
    dictRev[v] = k;
});

const uppercaseDriveLetter = (f) => {
    if (f.slice(1, 3) !== ":\\") return f;
    return f[0].toUpperCase() + f.slice(1);
};

const removeTrailingSlashes = (f) => {
    if (f === "/") {
        return f; // don't remove from "/"
    }

    if (f.slice(1) === ":\\") {
        return f; // don't remove from "D:\"
    }

    let last = f.length - 1;

    while (true) {
        const char = f.charAt(last);

        if (char === "\\") {
            f = f.slice(0, -1);
            last -= 1;
        } else if (char === "/") {
            f = f.slice(0, -1);
            last -= 1;
        } else {
            break;
        }
    }
    return f;
};

const isUrl = (p) => hasURL && p instanceof URL;

const pathToString = (p, win) => {
    let result;
    if (Buffer.isBuffer(p)) {
        result = p.toString();
    } else if (isUrl(p)) {
        result = win ? p.pathname.replace(/^\//, "") : p.pathname;
    } else {
        result = p;
    }

    return result;
};

const normalizePath = (f) => {
    let file = pathToString(f, win32);

    if (!/^.:$/.test(file)) {
        file = path.normalize(file);
    } // 'c:' -> 'c:.'

    if (win32) {
        file = uppercaseDriveLetter(file);
    }

    return removeTrailingSlashes(file);
};

const replace = (k) => {
    let v = DICT[k];
    // we have found a part of a missing file => let record for latter use
    if (v === undefined) {
        maxKey += 1;
        v = maxKey.toString(36);
        DICT[k] = v;
        dictRev[v] = k;
    }
    return v;
};

const findVirtualFileSystemKey = (path_, slash) => {
    const normalizedPath = normalizePath(path_);
    if (!DOCOMPRESS) {
        return normalizedPath;
    }
    const a = normalizedPath.split(slash).map(replace).join(separator);
    return a || normalizedPath;
};

const toOriginal = (fShort) => {
    if (!DOCOMPRESS) {
        return fShort;
    }
    return fShort
        .split(separator)
        .map((x) => dictRev[x])
        .join(path.sep);
};

const findVirtualFileSystemKeyAndFollowLinks = (path_) => {
    let vfsKey = findVirtualFileSystemKey(path_, path.sep);
    let needToSubstitute = true;
    while (needToSubstitute) {
        needToSubstitute = false;
        for (const [k, v] of symlinksEntries) {
            if (vfsKey.startsWith(`${k}${sepsep}`) || vfsKey === k) {
                vfsKey = vfsKey.replace(k, v);
                needToSubstitute = true;
                break;
            }
        }
    }
    return vfsKey;
};

const findVirtualFileSystemEntry = (path_) => {
    const vfsKey = findVirtualFileSystemKeyAndFollowLinks(path_);
    return VIRTUAL_FILESYSTEM[vfsKey];
};

// /////////////////////////////////////////////////////////////////
// END OF PKG CODE https://github.com/vercel/pkg ///////////////////
// /////////////////////////////////////////////////////////////////

const reverseLinks = (path_) => {
    let needToSubstitute = true;
    while (needToSubstitute) {
        needToSubstitute = false;
        for (const [k, v] of symlinksEntries) {
            if (path_.startsWith(`${v}${sepsep}`) || path_ === v) {
                path_ = path_.replace(v, k);
                needToSubstitute = true;
                break;
            }
        }
    }
    return path_;
};

const getFile = (fd, [startPos, size]) => {

    let code = Buffer.alloc(size);
    fs.readSync(fd, code, 0, size, PAYLOAD_POSITION + startPos);

    try {
        if (DOCOMPRESS === GZIP) code = gunzipSync(code);
        else if (DOCOMPRESS === BROTLI) code = brotliDecompressSync(code);
    } catch (e) {}

    return code;
};

const writeFile = (vfsPath, outputPath, blob) => {
    if (vfsPath.startsWith("C:")) vfsPath = vfsPath.replace("C:", "");

    outputPath = path.join(path.resolve(outputPath), vfsPath);

    if (!fs.existsSync(outputPath)) fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    fs.writeFileSync(outputPath, blob);
};

const executeFile = (blob) => {
    const options = {
        lineOffset: 0,
        displayErrors: true,
        cachedData: blob,
        sourceless: true,
    };
    const script = new Script(undefined, options);
    const wrapper = script.runInThisContext();

    if (!wrapper)
        throw new Error(
            `Internal JavaScript Evaluation Failure (for example VERSION_MISMATCH). Cannot execute the code!`
        );

    try {
        wrapper();
    } catch (e) {
        throw new Error(
            `Error while executing the code! Got the following error:\n${e.toString()}`
        );
    }

    return true;
};

let exec = false;

console.log(`Unpacking, ${Object.keys(VIRTUAL_FILESYSTEM).length} elements to go...`);

const STORE_BLOB = "0";
const STORE_CONTENT = "1";
const fd = fs.openSync(argv.i, "r");

for (let path in VIRTUAL_FILESYSTEM) {
    if (DOCOMPRESS) path = toOriginal(reverseLinks(path));

    const vfs = findVirtualFileSystemEntry(path);

    if (vfs[STORE_BLOB] || vfs[STORE_CONTENT]) {
        let blob = getFile(fd, vfs[STORE_CONTENT] || vfs[STORE_BLOB]);

        if (argv.run && path === props.entryPoint) {
            exec = executeFile(blob);
        }

        writeFile(path, argv.o, blob);
    }
}

console.log(`Binary unpacked to ${argv.o}`);

if (argv.run && !exec)
    console.log(
        "The code has not been executed! It may be because the entry point could not be found."
    );
