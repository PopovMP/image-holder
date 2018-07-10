"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const settings = require("./settings");
const dbManager = require("./db-manager");

const metaFilePath = path.join(__dirname, settings.metaFilePath);
dbManager.connect(metaFilePath);

/**
 * @typedef {object} ImageMeta
 * @property {string} name - image file name
 * @property {string} url - permanent link
 * @property {number} size - file size in kB
 * @property {string} hash - image content hash code
 * @property {number} time - time of upload
 */

/**
 * Saves an image
 * @param {string} fileName
 * @param {string} fileContent - base64 encoded
 * @param {boolean} isOverrideExisting
 * @param {string} host
 * @param {function} callback
 */
function saveFile(fileName, fileContent, isOverrideExisting, host, callback) {
    const dataType = getImageType(fileContent);

    if (settings.acceptedFiles.indexOf(dataType) === -1) {
        callback("Not supported file type.", null);
        return;
    }

    const imageBuffer = decodeImageContentToBuffer(fileContent);
    const fileSizeKb = Math.round(100 * imageBuffer.byteLength / 1024) / 100;

    if (fileSizeKb > settings.maxFileSizeKb) {
        const errorMessage = `The file is too big! It must be maximum ${settings.maxFileSizeKb} kB`;
        callback(errorMessage, null);
        return;
    }

    const isExists = dbManager.isExists(fileName);
    if (isExists && !isOverrideExisting) {
        const errorMessage = `Such file already exists! Use the "Override option", if you really want to replace the file.`;
        callback(errorMessage, null);
        return;
    }

    const filePath = path.join(__dirname, "public", settings.storagePath, fileName);

    fs.writeFile(filePath, imageBuffer, fs_writeFile_ready);

    /**
     * @param {string} err
     */
    function fs_writeFile_ready(err) {
        if (err) {
            callback(err, null);
            return;
        }

        const fileUrl = path.join(host, settings.storagePath, fileName);
        const fileHash = createHash(imageBuffer);
        const time = new Date().getTime();

        /** {ImageMeta} */
        const fileMeta = {
            name: fileName,
            url: fileUrl,
            size: fileSizeKb,
            hash: fileHash,
            time: time
        };

        dbManager.addOrUpdate(fileMeta);

        callback(null, fileMeta);
    }
}

/**
 * Deletes an image by filename and updates the DB
 * @param {string} fileName
 * @param {function} callback
 */
function deleteFile(fileName, callback) {
    const filePath = path.join(__dirname, "public", settings.storagePath, fileName);

    const isExistsDb = dbManager.isExists(fileName);

    if (isExistsDb) {
        const isExists = fs.existsSync(filePath);
        if (isExists) {
            fs.unlink(filePath, fs_unlink_ready);
        }
    } else {
        callback(`There is no such record: ${fileName}.`, null);
    }

    function fs_unlink_ready(err) {
        if (err) {
            callback(err, null);
        }

        dbManager.remove(fileName);
        callback(null, "File removed.");
    }
}

/**
 * Gets the mime type from a base64 encoded image
 * @param {string} data - base64 encoded
 * @return {string}
 */
function getImageType(data) {
    const match = data.match(/^data:image\/(\w+);base64,/);
    return match[1];
}

/**
 * Decodes a base64 image content to a buffer
 * @param {string} data - base64 encoded
 * @return {Buffer}
 */
function decodeImageContentToBuffer(data) {
    const strippedContent = data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = new Buffer(strippedContent, "base64");
    return buffer;
}

/**
 * Creates a sha256 hash code
 * @param {*} data
 * @return {string}
 */
function createHash(data) {
    const hash = crypto
        .createHash("sha256")
        .update(data)
        .digest("hex");

    return hash;
}

module.exports = {
    saveFile: saveFile,
    deleteFile: deleteFile
};
