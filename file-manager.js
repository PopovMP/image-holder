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
 * @property {string} thumbUrl - thumbnail permanent link
 * @property {number} size - file size in kB
 * @property {string} hash - image content hash code
 * @property {number} time - time of upload
 */

/**
 * Saves an image
 * @param {string} fileName
 * @param {string} imageData - base64 encoded
 * @param {string} thumbnailData - base64 encoded
 * @param {boolean} isForceUpload
 * @param {string} host
 * @param {function} callback
 */
function saveFile(fileName, imageData, thumbnailData, isForceUpload, host, callback) {

    const dataType = getImageType(imageData);

    if (settings.acceptedFiles.indexOf(dataType) === -1) {
        callback("Not supported file type.", null);
        return;
    }

    const imageBuffer = decodeImageContentToBuffer(imageData);
    const fileSizeKb = Math.round(100 * imageBuffer.byteLength / 1024) / 100;

    if (fileSizeKb > settings.maxFileSizeKb) {
        const errorMessage = `The file is too big! It must be maximum ${settings.maxFileSizeKb} kB`;
        callback(errorMessage, null);
        return;
    }

    const isNameExists = dbManager.isNameExists(fileName);
    if (isNameExists && !isForceUpload) {
        const errorMessage = "Such file already exists! Use the \"Force upload\" option, if you really want to replace the file.";
        callback(errorMessage, null);
        return;
    }

    const fileHash = createHash(imageBuffer);
    const isHashExists = dbManager.isHashExists(fileHash);
    if (isHashExists && !isForceUpload) {
        const errorMessage = "Such image is already uploaded under different name! Use the \"Force upload\" option, if you really want to upload it again.";
        callback(errorMessage, null);
        return;
    }

    const thumbnailFileName = getThumbnailFileName(fileName);
    const imagePath = path.join(__dirname, "public", settings.storagePath, fileName);
    const thumbnailPath = path.join(__dirname, "public", settings.storagePath, thumbnailFileName);

    fs.writeFile(imagePath, imageBuffer, fs_writeImage_ready);

    /**
     * @param {string} err
     */
    function fs_writeImage_ready(err) {
        if (err) {
            callback(err, null);
            return;
        }

        const thumbBuffer = decodeImageContentToBuffer(thumbnailData);

        fs.writeFile(thumbnailPath, thumbBuffer, fs_writeThumbnail_ready);
    }

    /**
     * @param {string} err
     */
    function fs_writeThumbnail_ready(err) {
        if (err) {
            callback(err, null);
            return;
        }

        const fileUrl = path.join(host, settings.storagePath, fileName);
        const thumbUrl = path.join(host, settings.storagePath, thumbnailFileName);
        const time = new Date().getTime();

        /** {ImageMeta} */
        const fileMeta = {
            name: fileName,
            url: fileUrl,
            thumbUrl: thumbUrl,
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

    const isExistsDb = dbManager.isNameExists(fileName);

    if (isExistsDb) {
        const isExists = fs.existsSync(filePath);
        if (isExists) {
            fs.unlink(filePath, imageUnlink_ready);
        }
    } else {
        callback(`There is no such record: ${fileName}.`, null);
    }

    function imageUnlink_ready(err) {
        if (err) {
            callback(err, null);
        }

        dbManager.remove(fileName);

        const thumbName = getThumbnailFileName(fileName);
        const thumbPath = path.join(__dirname, "public", settings.storagePath, thumbName);
        const isThumbExists = fs.existsSync(thumbPath);
        if (isThumbExists) {
            fs.unlink(thumbPath, thumbUnlink_ready);
        } else {
            callback(null, `Image deleted: ${fileName}.`);
        }
    }

    function thumbUnlink_ready(err) {
        if (err) {
            callback(err, null);
        }
        callback(null, `Image deleted: ${fileName}.`);
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
 * @param {string} imageName
 */
function getThumbnailFileName(imageName) {
    const parsedPath = path.parse(imageName);
    const thumbnailName = `${parsedPath.name}-thumb${parsedPath.ext}`;
    return thumbnailName;
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
