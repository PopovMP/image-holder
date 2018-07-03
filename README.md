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

Node.js https://nodejs.org

## Settings

settings.json

```json
{
  "port": 80,
  "passCode": 42,
  "storagePath": "store"
}
```

 The passCode can be a number or a string.

## ToDo

### Tasks

 - Check and create the storage folder on startup.
 - Store the last 10 image links in the Browser's Local Storage. Show images preview on loading.
 - Add a suffix to the image name if such one already exists.
 - Add an option for overriding an existing images. 

### Ideas
 - Use a template engine (pug, ejs) for the views in order to be possible to load settings.
 - Store the last 100 images mata data on the server. load them in teh index page.
 - Add a "Delete" button to the image preview.
 - If the passCode is "" or 0, remove the "Pass code" input. It will make the service public. No image delete or file rewrite must be available in that case.

## Powered by

Forex Software Ltd. at https://forexsb.com/
