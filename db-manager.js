"use strict";

const fs = require("fs");

let dbFilePath;
let dbContent = [];

/**
 * Loads a db file
 * @param {string} dbPath
 */
function connect(dbPath) {
    dbFilePath = dbPath;
    const isExists = fs.existsSync(dbFilePath);
    if (isExists) {
        const content = fs.readFileSync(dbFilePath, "utf8");
        dbContent = JSON.parse(content);
    }
}

/**
 * Searches an image by name
 * @param {string} pattern - RegExp
 * @return {ImageMeta[]}
 */
function find(pattern) {
    const regExp = new RegExp(pattern, "i");
    const selection = dbContent.filter(record => regExp.test(record.name));

    return selection;
}

/**
 * Gets if such image name already exists
 * @param {string} fileName
 * @return {boolean}
 */
function isNameExists(fileName) {
    const isNameExists = dbContent.some(e => e.name === fileName);

    return isNameExists;
}

/**
 * Gets if such image content already exists
 * @param {string} fileHash
 * @return {boolean}
 */
function isHashExists(fileHash) {
    const isHashExists = dbContent.some(e => e.hash === fileHash);

    return isHashExists;
}

/**
 * Gets images
 * @param {number} start - start index
 * @param {number} end - end index
 * @return {ImageMeta[]}
 */
function get(start, end) {
    const selection = dbContent.slice(start, end);

    return selection;
}

/**
 * Gets the count of the stored images.
 * @return {number}
 */
function count() {
    return dbContent.length;
}

/**
 * Adds or updates a meta record in DB by name and saves the DB file.
 * @param {ImageMeta} record
 */
function addOrUpdate(record) {
    for (let i = 0; i < dbContent.length; i++) {
        if (dbContent[i].name === record.name) {
            dbContent[i] = record;

            save();

            return;
        }
    }

    dbContent.push(record);

    save();
}

/**
 * Removes a record with the given name from DB
 * @param fileName
 */
function remove(fileName) {
    for (let i = dbContent.length - 1; i >= 0; i--) {
        if (dbContent[i].name === fileName) {
            dbContent.splice(i, 1);

            save();
        }
    }
}

/**
 * Stores the db file
 */
function save() {
    const dbText = JSON.stringify(dbContent);
    fs.writeFile(dbFilePath, dbText, "utf8", fs_writeFile_ready);

    function fs_writeFile_ready(err) {
        if (err) {
            console.error(err);
        }
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
