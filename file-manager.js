"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const settings = require("./settings");
const dbManager = require("./db-manager");

const metaFilePath = path.join(__dirname, settings.metaFilePath);
dbManager.connect(metaFilePath);

function saveFile(fileName, fileContent, isOverrideExisting, host, callback) {
    const data = fileContent.replace(/^data:image\/\w+;base64,/, "");
    const buffer = new Buffer(data, "base64");
    const fileSizeKb = Math.round(100 * buffer.byteLength / 1024) / 100;

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

    fs.writeFile(filePath, buffer, fs_writeFile_ready);

    function fs_writeFile_ready(err) {
        if (err) {
            callback(err, null);
            return;
        }

        const fileUrl = path.join(host, settings.storagePath, fileName);
        const fileHash = createHash(buffer);
        const time = new Date().getTime();

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
