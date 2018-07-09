"use strict";

const fs = require("fs");

let dbFilePath;
let dbContent = [];

function connect(dbPath) {
    dbFilePath = dbPath;
    const isExists = fs.existsSync(dbFilePath);
    if (isExists) {
        const content = fs.readFileSync(dbFilePath, "utf8");
        dbContent = JSON.parse(content);
    }
}

function find(pattern, start, count) {
    start = start || 0;
    count = count || dbContent.length - start;

    const regExp = new RegExp(pattern, "i").compile();
    const selection = dbContent
        .filter(record => regExp.test(record.name))
        .slice(start, start + count);

    return selection;
}

function get(start, count) {
    start = start || 0;
    count = count || dbContent.length - start;

    const selection = dbContent.slice(start, count);

    return selection;
}

function count() {
    return dbContent.length;
}

function insert(record) {
    for (let i = 0; i < dbContent.length; i++) {
        if (dbContent[i].hash === record.hash) {
            dbContent[i] = record;
            save();
            return i;
        }
    }

    dbContent.push(record);
    save();

    return dbContent.length;
}

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
    insert: insert
};
