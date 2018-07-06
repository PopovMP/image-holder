"use strict";

const fs = require("fs");
const path = require("path");

const settings = require("./settings");

function saveFile(fileName, fileContent, host, callback) {
    const data = fileContent.replace(/^data:image\/\w+;base64,/, "");
    const buffer = new Buffer(data, "base64");
    const filePath = path.join(__dirname, "public", settings.storagePath, fileName);

    fs.writeFile(filePath, buffer, fs_writeFile_ready);

    function fs_writeFile_ready(err) {
        if (err) {
            callback(err, null);
        } else {
            const fileUrl = path.join(host, settings.storagePath, fileName);
            callback(null, fileUrl);
        }
    }
}

module.exports = {
    saveFile: saveFile
};
