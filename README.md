# Image Holder

It is a very simple self-hosted image holder service.

License: MIT

## Features

 - Image Holder is a self hosted app on node.js
 - it provides a Drag / Drop images upload.
 - it stores the files and thumbnails in a public local folder.
 - it may require a pass key for an upload (set in the server's settings).
 - it shows teh latest images preview on load.
 - it has a RegExp search through all uploaded images.
 - it manages duplicated files.
 - it validates the image size, file extension and the mime type.
 - it shows code for integration in forums (the code format is customizable).

Image Holder in action: https://image-holder.forexsb.com/

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
  "maxSearchCount": 20,
  "showLastImages": 20,
  "thumbnailPattern": "[URL=img-url][IMG]thumb-url[/IMG][/URL]",
  "thumbnailWidth": 300,
  "thumbnailHeight": 200
}
```

 The passCode can be a number or a string. If it is 0 or "", the "Pass code" input is hidden.

## Powered by

Forex Software Ltd. at https://forexsb.com/
