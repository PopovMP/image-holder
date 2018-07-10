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
 * @param {number} start
 * @param {number} count
 * @return {ImageMeta[]}
 */
function find(pattern, start, count) {
    start = start || 0;
    count = count || dbContent.length - start;

    const regExp = new RegExp(pattern, "i");
    const selection = dbContent
        .filter(record => regExp.test(record.name))
        .slice(start, start + count);

    return selection;
}

/**
 * Gets if such image already exists
 * @param {string} fileName
 * @return {boolean}
 */
function isExists(fileName) {
    const isExits = dbContent.some(e => e.name === fileName);

    return isExits;
}

/**
 * Gets images
 * @param {number} start - start index
 * @param {number} count - count of records
 * @return {ImageMeta[]}
 */
function get(start, count) {
    start = start || 0;
    count = count || dbContent.length - start;

    const selection = dbContent.slice(start, count);

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
 * Inserts a meta record in db and saves.
 * @param {ImageMeta} record
 * @return {number}
 */
function insert(record) {
    dbContent.push(record);

    save();

    return dbContent.length;
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
    isExists: isExists,
    insert: insert
};
