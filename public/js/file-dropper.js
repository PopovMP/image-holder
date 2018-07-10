"use strict";

class FileDropper {
    constructor(fileExtensions) {
        this.fileLoaded = null;
        this.errorOccurred = null;
        this.warningOccurred = null;
        this.fileExtensions = fileExtensions;

        this.dropperPanel = document.getElementById("data-import-dropzone");
        this.dropperInput = document.getElementById("data-import-input");

        this.dropperPanel.addEventListener("click", this.view_dropperPanel_click.bind(this), false);
        this.dropperPanel.addEventListener("dragover", this.view_dropperPanel_dragOver.bind(this), false);
        this.dropperPanel.addEventListener("dragleave", this.view_dropperPanel_dragLeave.bind(this), false);
        this.dropperPanel.addEventListener("mouseleave", this.view_dropperPanel_mouseLeave.bind(this), false);
        this.dropperPanel.addEventListener("drop", this.view_dropperPanel_drop.bind(this), false);
        this.dropperInput.addEventListener("change", this.view_inputDropzone_change.bind(this), false);
    }

    view_dropperPanel_click() {
        this.dropperInput.click();
    }

    view_dropperPanel_dragOver(event) {
        event.stopPropagation();
        event.preventDefault();

        this.dropperPanel.className = "hover";
    }

    view_dropperPanel_dragLeave(event) {
        event.stopPropagation();
        event.preventDefault();

        this.dropperPanel.className = "";
    }

    view_dropperPanel_mouseLeave(event) {
        event.stopPropagation();
        event.preventDefault();

        this.dropperPanel.className = "";
    }

    view_dropperPanel_drop(event) {
        event.stopPropagation();
        event.preventDefault();

        if (event.dataTransfer.files instanceof FileList) {
            for (const file of event.dataTransfer.files) {
                this.readFile(file);
            }
        }

        this.dropperInput.value = "";
    }

    view_inputDropzone_change(event) {
        event.stopPropagation();
        event.preventDefault();

        if (event.target.files instanceof FileList) {
            for (const file of event.target.files) {
                this.readFile(file);
            }
        }

        this.dropperInput.value = "";
    }

    readFile(file) {
        const isFile = file instanceof File;

        if (!isFile) {
            this.onWarningOccurred("", "It is not a file");
            return;
        }

        const isSupportedFile = this.testFileExtension(file.name, this.fileExtensions);

        if (!isSupportedFile) {
            this.onWarningOccurred(file.name, "It is not a supported file type.");
            return;
        }

        const fileReader = new FileReader();
        fileReader.addEventListener("load", this.fileReader_load.bind(this, file.name), false);
        fileReader.readAsDataURL(file);
    }

    testFileExtension(fileName, extensions) {
        for (const extension of extensions) {
            const regExp = new RegExp(`.${extension}$`, "i");
            const isMatch = regExp.test(fileName);
            if (isMatch) {
                return true;
            }
        }
        return false;
    }

    fileReader_load(fileName, event) {
        event.stopPropagation();
        event.preventDefault();

        event.target.removeEventListener("load", this.fileReader_load);

        try {
            this.onFileLoaded(fileName, event.target.result);
        } catch (e) {
            this.onErrorOccurred(fileName, e.message);
        }
    }

    onFileLoaded(fileName, fileContent) {
        if (typeof this.fileLoaded === "function") {
            this.fileLoaded(fileName, fileContent);
        }
    }

    onWarningOccurred(fileName, warningMessage) {
        if (typeof this.warningOccurred === "function") {
            this.warningOccurred(fileName, warningMessage);
        }
    }

    onErrorOccurred(fileName, errorMessage) {
        if (typeof this.errorOccurred === "function") {
            this.errorOccurred(fileName, errorMessage);
        }
    }
}
