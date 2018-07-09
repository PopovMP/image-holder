# Image Holder

It is a very simple self-hosted image holder service.

License: MIT

## Features

 - Image Holder is a self hosted app on node.js
 - It provides a Drag / Drop images upload.
 - It stores the files in a public local folder.
 - It may require a pass key for an upload (set in the server's settings).
 - It shows teh latest images preview on load.
 - RegExp search through all uploaded images.
 
 ![Screnshot](https://image-holder.forexsb.com/store/image-holder-screenshot.png)

## Requirements

Node.js https://nodejs.org

## Settings

settings.json

```json
{
  "acceptedFiles": [
    "png",
    "jpg",
    "jpeg"
  ],
  "maxFileSizeKb": 1024,
  "passCode": 42,
  "port": 8080,
  "storagePath": "store",
  "metaFilePath": "db/meta.json",
  "showLastImages": 20
}
```

 The passCode can be a number or a string. If it is 0 or "", the "Pass code" input is hidden.

## Powered by

Forex Software Ltd. at https://forexsb.com/
