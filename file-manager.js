"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const settings = require("./settings");
const dbManager = require("./db-manager");

const metaFilePath = path.join(__dirname, settings.metaFilePath);
dbManager.connect(metaFilePath)

function saveFile(fileName, fileContent, isOverrideExisting, host, callback) {
    const data = fileContent.replace(/^data:image\/\w+;base64,/, "");
    const buffer = new Buffer(data, "base64");
    const filePath = path.join(__dirname, "public", settings.storagePath, fileName);

    fs.writeFile(filePath, buffer, fs_writeFile_ready);

    function fs_writeFile_ready(err) {
        if (err) {
            callback(err, null);
            return;
        }

        const fileUrl = path.join(host, settings.storagePath, fileName);
        const fileSizeKb = Math.round(100 * buffer.byteLength / 1024) / 100;
        const fileHash = createHash(buffer);
        const time = new Date().getTime();

        if (fileSizeKb > settings.maxFileSizeKb) {
            callback("The file is too big!", null);
            return;
        }

        const fileMeta = {
            name: fileName,
            url: fileUrl,
            size: fileSizeKb,
            hash: fileHash,
            time: time
        };

        dbManager.insert(fileMeta);

        callback(null, fileMeta);
    }
}

function createHash(data) {
    const hash = crypto
        .createHash("sha256")
        .update(data)
        .digest("hex");

    return hash;
}

module.exports = {
    saveFile: saveFile
};
