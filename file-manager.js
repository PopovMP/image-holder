"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const settings = require("./settings");
const dbManager = require("./db-manager");

const storeDir = path.resolve(__dirname, "public", settings.storagePath);
const storePrefix = storeDir + path.sep;

const metaFilePath = path.join(__dirname, settings.metaFilePath);
dbManager.connect(metaFilePath);

const allowedExtensions = new Set(settings.acceptedFiles.map(extension => extension.toLowerCase()));

// Letters, digits, spaces and the punctuation already present in the existing
// library. Anything else (slashes, quotes, percent, control chars, leading
// dots) is rejected, which keeps stored names safe for URLs and HTML.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9 .()+_-]{0,127}$/;

const MAX_NAME_LENGTH = 128;

// Leading magic bytes per extension.
const SIGNATURES = {
    png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    jpg: [[0xff, 0xd8, 0xff]],
    jpeg: [[0xff, 0xd8, 0xff]],
    gif: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    webp: [[0x52, 0x49, 0x46, 0x46]]
};

/**
 * @typedef {object} ImageMeta
 * @property {string} name - image file name
 * @property {string} url - permanent link
 * @property {string} thumbUrl - thumbnail permanent link
 * @property {number} size - file size in kB
 * @property {string} hash - image content hash code
 * @property {number} time - time of upload
 */

/**
 * Saves an image and its thumbnail.
 * @param {string} fileName
 * @param {string} imageData - base64 data URL
 * @param {string} thumbnailData - base64 data URL
 * @param {boolean} isForceUpload
 * @param {function} callback - called exactly once with (errorString, ImageMeta)
 */
function saveFile(fileName, imageData, thumbnailData, isForceUpload, callback) {
    const done = once(callback);

    try {
        saveFileUnguarded(fileName, imageData, thumbnailData, isForceUpload, done);
    } catch (e) {
        done(e.message || String(e), null);
    }
}

/**
 * @param {string} fileName
 * @param {string} imageData
 * @param {string} thumbnailData
 * @param {boolean} isForceUpload
 * @param {function} done
 */
function saveFileUnguarded(fileName, imageData, thumbnailData, isForceUpload, done) {
    const nameProblem = validateFileName(fileName);

    if (nameProblem) {
        done(nameProblem, null);
        return;
    }

    const image = parseImageData(imageData, fileName);

    if (image.error) {
        done(image.error, null);
        return;
    }

    const fileSizeKb = Math.round(100 * image.buffer.byteLength / 1024) / 100;

    if (fileSizeKb > settings.maxFileSizeKb) {
        done(`The file is too big! It must be maximum ${settings.maxFileSizeKb} kB`, null);
        return;
    }

    const thumbnail = parseImageData(thumbnailData, fileName);

    if (thumbnail.error) {
        done(`Thumbnail: ${thumbnail.error}`, null);
        return;
    }

    if (thumbnail.kind !== image.kind) {
        done("The thumbnail format does not match the image format.", null);
        return;
    }

    if (dbManager.isNameExists(fileName) && !isForceUpload) {
        done("Such file already exists! Use the \"Force upload\" option, if you really want to replace the file.", null);
        return;
    }

    const fileHash = createHash(image.buffer);

    if (dbManager.isHashExists(fileHash) && !isForceUpload) {
        done("Such image is already uploaded under different name! Use the \"Force upload\" option, if you really want to upload it again.", null);
        return;
    }

    const thumbnailFileName = getThumbnailFileName(fileName);
    const conflict = thumbnailConflict(fileName, thumbnailFileName);

    if (conflict) {
        done(conflict, null);
        return;
    }

    const imagePath = resolveInStore(fileName);
    const thumbnailPath = resolveInStore(thumbnailFileName);

    if (!imagePath || !thumbnailPath) {
        done("Wrong file name!", null);
        return;
    }

    fs.writeFile(imagePath, image.buffer, err => {
        if (err) {
            done(`Cannot store the image: ${err.message}`, null);
            return;
        }

        fs.writeFile(thumbnailPath, thumbnail.buffer, thumbErr => {
            if (thumbErr) {
                // Do not leave a half-written upload behind.
                fs.unlink(imagePath, () => {
                    done(`Cannot store the thumbnail: ${thumbErr.message}`, null);
                });
                return;
            }

            const fileMeta = {
                name: fileName,
                url: buildUrl(fileName),
                thumbUrl: buildUrl(thumbnailFileName),
                size: fileSizeKb,
                hash: fileHash,
                time: Date.now()
            };

            try {
                dbManager.addOrUpdate(fileMeta);
            } catch (e) {
                done(`The image was written but the database failed: ${e.message}`, null);
                return;
            }

            done(null, fileMeta);
        });
    });
}

/**
 * Deletes an image and its thumbnail by name.
 * @param {string} fileName
 * @param {function} callback - called exactly once with (errorString, message)
 */
function deleteFile(fileName, callback) {
    const done = once(callback);

    if (!dbManager.isNameExists(fileName)) {
        done(`There is no such record: ${fileName}.`, null);
        return;
    }

    const imagePath = resolveInStore(fileName);
    const thumbnailPath = resolveInStore(getThumbnailFileName(fileName));

    if (!imagePath || !thumbnailPath) {
        done("Wrong file name!", null);
        return;
    }

    removeFile(imagePath, imageErr => {
        if (imageErr) {
            done(`Cannot delete the image: ${imageErr.message}`, null);
            return;
        }

        removeFile(thumbnailPath, thumbErr => {
            if (thumbErr) {
                done(`Cannot delete the thumbnail: ${thumbErr.message}`, null);
                return;
            }

            dbManager.remove(fileName);
            done(null, `Image deleted: ${fileName}.`);
        });
    });
}

/**
 * Unlinks a file, treating a missing file as success so the DB can be cleaned
 * up even when the bytes are already gone.
 * @param {string} filePath
 * @param {function} callback
 */
function removeFile(filePath, callback) {
    fs.unlink(filePath, err => {
        if (err && err.code !== "ENOENT") {
            callback(err);
            return;
        }

        callback(null);
    });
}

/**
 * @param {string} fileName
 * @return {string|null} a problem description, or null when valid
 */
function validateFileName(fileName) {
    if (typeof fileName !== "string" || fileName.length === 0) {
        return "Wrong file name!";
    }

    if (fileName.length > MAX_NAME_LENGTH) {
        return `The file name is too long (maximum ${MAX_NAME_LENGTH} characters).`;
    }

    if (!SAFE_NAME.test(fileName)) {
        return "The file name may only contain letters, digits, spaces and the characters - _ . ( ) +";
    }

    const extension = path.extname(fileName).toLowerCase().slice(1);

    if (!allowedExtensions.has(extension)) {
        return `Not supported file type. Allowed: ${[...allowedExtensions].join(", ")}.`;
    }

    return null;
}

/**
 * Parses and validates a base64 image data URL.
 * @param {string} data
 * @param {string} fileName
 * @return {{error?: string, buffer?: Buffer, kind?: string}}
 */
function parseImageData(data, fileName) {
    if (typeof data !== "string" || data.length === 0) {
        return {error: "Empty image content."};
    }

    const match = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(data);

    if (!match) {
        return {error: "Not supported file type."};
    }

    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(data.slice(match[0].length), "base64");

    if (buffer.byteLength === 0) {
        return {error: "Empty image content."};
    }

    const extension = path.extname(fileName).toLowerCase().slice(1);
    const kind = mime === "jpeg" ? "jpg" : mime;

    if (kind !== (extension === "jpeg" ? "jpg" : extension)) {
        return {error: "The image content does not match the file extension."};
    }

    if (!allowedExtensions.has(extension) || !hasValidSignature(buffer, extension)) {
        return {error: "The file content is not a valid image."};
    }

    return {buffer: buffer, kind: kind};
}

/**
 * @param {Buffer} buffer
 * @param {string} extension
 * @return {boolean}
 */
function hasValidSignature(buffer, extension) {
    const candidates = SIGNATURES[extension];

    if (!candidates) {
        return true;
    }

    return candidates.some(signature => signature.every((byte, index) => buffer[index] === byte));
}

/**
 * Detects names whose file would overwrite another record's thumbnail.
 * @param {string} fileName
 * @param {string} thumbnailFileName
 * @return {string|null}
 */
function thumbnailConflict(fileName, thumbnailFileName) {
    if (thumbnailFileName !== fileName && dbManager.isNameExists(thumbnailFileName)) {
        return `"${thumbnailFileName}" already exists as a separate image, so it cannot be used as the thumbnail name.`;
    }

    const parsed = path.parse(fileName);

    if (parsed.name.toLowerCase().endsWith("-thumb")) {
        const parentName = `${parsed.name.slice(0, -"-thumb".length)}${parsed.ext}`;

        if (dbManager.isNameExists(parentName)) {
            return `"${fileName}" would overwrite the thumbnail of "${parentName}".`;
        }
    }

    return null;
}

/**
 * Builds the permanent public link for a stored file. The name part is kept
 * as-is to stay byte-compatible with existing records; the client encodes it
 * when rendering.
 * @param {string} fileName
 * @return {string}
 */
function buildUrl(fileName) {
    const base = String(settings.publicBaseUrl || "").replace(/\/+$/, "");
    const encodedBase = encodeURIComponent(base);

    return `${encodedBase}/${settings.storagePath}/${fileName}`;
}

/**
 * Resolves a file name inside the storage directory, refusing anything else.
 * @param {string} fileName
 * @return {string|null}
 */
function resolveInStore(fileName) {
    const resolved = path.resolve(storeDir, fileName);

    if (!resolved.startsWith(storePrefix)) {
        return null;
    }

    return resolved;
}

/**
 * @param {string} imageName
 * @return {string}
 */
function getThumbnailFileName(imageName) {
    const parsedPath = path.parse(imageName);

    return `${parsedPath.name}-thumb${parsedPath.ext}`;
}

/**
 * @param {Buffer} data
 * @return {string}
 */
function createHash(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Wraps a callback so it can only ever fire once.
 * @param {function} callback
 * @return {function}
 */
function once(callback) {
    let isCalled = false;

    return function (...args) {
        if (isCalled) {
            return;
        }

        isCalled = true;
        callback(...args);
    };
}

module.exports = {
    deleteFile: deleteFile,
    saveFile: saveFile,
    validateFileName: validateFileName
};
