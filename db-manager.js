"use strict";

/**
 * Tiny JSON-file backed record store.
 *
 * Writes are synchronous, atomic (temp file + fsync + rename) and keep a
 * `.bak` copy of the previous good state, so a crash mid-write can never
 * truncate the database. If the main file is unreadable at startup the
 * backup is used, and the damaged file is kept aside for inspection.
 */

const fs = require("fs");
const path = require("path");

let dbFilePath;
let dbContent = [];

/**
 * Loads the db file, falling back to the backup copy.
 * @param {string} dbPath
 */
function connect(dbPath) {
    dbFilePath = dbPath;
    dbContent = load();
}

/**
 * @return {ImageMeta[]}
 */
function load() {
    const backupPath = `${dbFilePath}.bak`;
    const problems = [];

    for (const candidate of [dbFilePath, backupPath]) {
        if (!fs.existsSync(candidate)) {
            continue;
        }

        try {
            const raw = fs.readFileSync(candidate, "utf8");
            const parsed = JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                throw new Error("expected an array of records");
            }

            const records = parsed.filter(isRecord);
            const dropped = parsed.length - records.length;

            if (dropped > 0) {
                console.warn(`[db] Ignored ${dropped} malformed record(s) in ${candidate}.`);
            }

            if (candidate !== dbFilePath) {
                console.warn(`[db] Main database unreadable, recovered ${records.length} record(s) from ${backupPath}.`);
            } else {
                console.log(`[db] ${records.length} record(s) loaded.`);
            }

            return records;
        } catch (e) {
            problems.push(`${candidate}: ${e.message}`);

            if (candidate === dbFilePath) {
                quarantine(candidate);
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(`Cannot read the image database. ${problems.join("; ")}`);
    }

    return [];
}

/**
 * Keeps a damaged database file for forensics instead of overwriting it.
 * @param {string} filePath
 */
function quarantine(filePath) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    try {
        fs.renameSync(filePath, `${filePath}.corrupt-${stamp}`);
        console.error(`[db] Moved unreadable database to ${filePath}.corrupt-${stamp}`);
    } catch (e) {
        console.error(`[db] Could not quarantine ${filePath}: ${e.message}`);
    }
}

/**
 * @param {*} record
 * @return {boolean}
 */
function isRecord(record) {
    return Boolean(record)
        && typeof record === "object"
        && typeof record.name === "string"
        && record.name.length > 0;
}

/**
 * Searches an image by name. The phrase is treated as a literal string, never
 * as a pattern, so user input cannot throw or backtrack catastrophically.
 * @param {string} pattern
 * @return {ImageMeta[]}
 */
function find(pattern) {
    const phrase = String(pattern === undefined || pattern === null ? "" : pattern).slice(0, 200);
    const regExp = new RegExp(escapeRegExp(phrase), "i");

    return dbContent.filter(record => regExp.test(record.name));
}

/**
 * @param {string} text
 * @return {string}
 */
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} fileName
 * @return {boolean}
 */
function isNameExists(fileName) {
    return dbContent.some(record => record.name === fileName);
}

/**
 * @param {string} fileHash
 * @return {boolean}
 */
function isHashExists(fileHash) {
    return dbContent.some(record => record.hash === fileHash);
}

/**
 * @param {number} start
 * @param {number} end
 * @return {ImageMeta[]}
 */
function get(start, end) {
    return dbContent.slice(start, end);
}

/**
 * @return {number}
 */
function count() {
    return dbContent.length;
}

/**
 * Adds or updates a record by name and persists the file.
 * @param {ImageMeta} record
 */
function addOrUpdate(record) {
    const index = dbContent.findIndex(existing => existing.name === record.name);

    if (index === -1) {
        dbContent.push(record);
    } else {
        dbContent[index] = record;
    }

    save();
}

/**
 * Removes all records with the given name and persists the file.
 * @param {string} fileName
 */
function remove(fileName) {
    const before = dbContent.length;

    dbContent = dbContent.filter(record => record.name !== fileName);

    if (dbContent.length !== before) {
        save();
    }
}

/**
 * Persists the database atomically.
 */
function save() {
    const tmpPath = `${dbFilePath}.tmp`;
    const backupPath = `${dbFilePath}.bak`;

    try {
        fs.mkdirSync(path.dirname(dbFilePath), {recursive: true});

        const fd = fs.openSync(tmpPath, "w", 0o600);

        try {
            fs.writeFileSync(fd, JSON.stringify(dbContent), "utf8");
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }

        if (fs.existsSync(dbFilePath)) {
            fs.copyFileSync(dbFilePath, backupPath);
            fs.chmodSync(backupPath, 0o600);
        }

        // Atomic on POSIX: readers see either the old or the new file.
        fs.renameSync(tmpPath, dbFilePath);
    } catch (e) {
        console.error(`[db] Failed to save ${dbFilePath}: ${e.message}`);
        throw e;
    }
}

module.exports = {
    count: count,
    connect: connect,
    find: find,
    get: get,
    isNameExists: isNameExists,
    isHashExists: isHashExists,
    addOrUpdate: addOrUpdate,
    remove: remove
};
