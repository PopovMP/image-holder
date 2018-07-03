# Image Holder

It is a very simple self-hosted image holder service.

License: MIT

## Features

 - Self hosted app on node.js
 - Provides a Drag / Drop images upload.
 - Stores the files in a public local folder.
 - Requires a pass key for an upload (set in the server).
 - Shows an image preview.
 - It is possible to upload multiple images at once.
  
![Screnshot](https://image-holder.forexsb.com/store/image-holder-screenshot.png)

## Requirements

Node.js https://nodejs.org/en/

## Settings

settings.json

```json
{
  "port": 80,
  "passCode": 42,
  "storagePath": "store"
}
```

## ToDo

### Tasks

 - Check and create the storage folder on startup.
 - Store the last 10 images links in the Local Storage. Load preview of the images on the index.

### Ideas
 - Use a template engine (pug, ejs) for the views in order to be possible to load settings.

## Powered by

Forex Software Ltd. at https://forexsb.com/
