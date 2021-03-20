"use strict";

class ApplicationPresenter {
    constructor(thumbnailPattern, isPassCodeRequired) {
        this.searchImage = null;
        this.passCodeSubmit = null;
        this.deleteImage = null;
        this.idIndex = 0;

        this.isPassCodeRequired = isPassCodeRequired;
        this.thumbnailPattern = thumbnailPattern;

        if (this.isPassCodeRequired) {
            this.formPassCode = document.getElementById("form-pass-code");
            this.inputPassCode = document.getElementById("pass-code-element");
            this.formPassCode.addEventListener("submit", this.formPassCode_submit.bind(this))
        } else {
            this.showUploadControls();
        }

        this.checkboxForceUpload = document.getElementById("checkbox-force-upload");

        this.formSearch = document.getElementById("form-search");
        this.inputSearch = document.getElementById("input-search");
        this.outputContent = document.getElementById("output-content");

        this.formSearch.addEventListener("submit", this.formSearch_submit.bind(this));
    }

    getSubmitOptions() {
        const optionsModel = {
            passCode: this.isPassCodeRequired ? this.inputPassCode.value : "",
            isForceUpload: this.checkboxForceUpload.checked
        };

        return optionsModel;
    }

    showUploadControls() {
        if (this.isPassCodeRequired) {
            document.getElementById("form-pass-code").classList.add("hidden");
        }
        document.getElementById("data-import-dropzone").classList.remove("hidden");
        document.getElementById("form-upload-options").classList.remove("hidden");
    }

    scaleImage(imageData, maxWidth, maxHeight, callback) {
        const mimeType = this.getImageMimeType(imageData);

        const htmlImage = new Image();
        htmlImage.addEventListener("load", imageLoaded);
        htmlImage.src = imageData;

        function imageLoaded() {
            const srcRatio = htmlImage.width / htmlImage.height;
            const maxRatio = maxWidth / maxHeight;
            const width = srcRatio < maxRatio ? Math.round(htmlImage.width * maxHeight / htmlImage.height) : maxWidth;
            const height = srcRatio > maxRatio ? Math.round(htmlImage.height * maxWidth / htmlImage.width) : maxHeight;

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");

            context.drawImage(htmlImage, 0, 0, width, height);

            const thumbData = canvas.toDataURL(mimeType);

            callback(thumbData);
        }
    }

    getImageMimeType(imageData) {
        const match = imageData.match(/data:(.*);base64/);
        const mimeType = match && match.length === 2 ? match[1] : "";
        return mimeType;
    }

    showImageOutput(fileMeta) {
        const idIndex = ++this.idIndex;
        const messageBoxId = `message-${idIndex}`;
        const imgPreviewId = `img-${idIndex}`;
        const delId = `dell-${idIndex}`;

        const url = decodeURIComponent(fileMeta.url).replace(/ /g, "%20");
        const time = new Date(fileMeta.time).toLocaleString();
        const thumbnailCode = fileMeta.thumbUrl ? this.getThumbnailCode(fileMeta) : "";

        const messageElement =
            `<div class="message url-filed" id="${messageBoxId}">
                <a id="${delId}" href="#" class="delete-button" title="Delete image">x</a>
                <h3 class="image-box-header">${fileMeta.name}</h3>
                <p>Size: ${fileMeta.size} kB, uploaded at: ${time}</p>
                <a href="${url}" target="_blank"><img id="${imgPreviewId}" class="image-preview" src="" alt="Image preview" /></a>
                <br />
                <input class="url-input" type="text" value="${url}" />
                ${thumbnailCode}
            </div>`;

        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);

        const imagePreview = document.getElementById(imgPreviewId);
        imagePreview["src"] = url;

        const deleteButton = document.getElementById(delId);
        deleteButton.addEventListener("click", this.image_delete_click.bind(this, fileMeta.name, messageBoxId));
    }

    getThumbnailCode(fileMeta) {
        const url = decodeURIComponent(fileMeta.url).replace(/ /g, "%20");
        const thumbUrl = decodeURIComponent(fileMeta.thumbUrl).replace(/ /g, "%20");
        const code = this.thumbnailPattern.replace("img-url", url).replace("thumb-url", thumbUrl);
        const html = `<br /><input class="url-input" type="text" value="${code}" />`;
        return html;
    }

    clearOutput() {
        this.outputContent.innerHTML = "";
    }

    showInfo(message) {
        this.showMessage(message, "info");
    }

    showWarning(message) {
        this.showMessage(message, "warning");
    }

    showError(message) {
        this.showMessage(message, "error");
    }

    showMessage(message, tag) {
        const idIndex = ++this.idIndex;
        const messageBoxId = `message-${idIndex}`;
        const delId = `dell-${idIndex}`;

        const messageElement =
            `<div class="message ${tag}" id="${messageBoxId}">
                <a id="${delId}" href="#" class="delete-button" title="Remove message">x</a>
                <p style="margin: 0">${message}</p>
            </div>`;

        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);

        const deleteButton = document.getElementById(delId);
        deleteButton.addEventListener("click", this.removeMessage_click.bind(this, messageBoxId));
    }

    removeMessageBox(messageBoxId) {
        document.getElementById(messageBoxId).remove();
    }

    formSearch_submit(event) {
        event.preventDefault();

        if (typeof this.searchImage === "function") {
            const phrase = this.inputSearch.value;
            this.searchImage(phrase);
        }
    }

    formPassCode_submit(event) {
        event.preventDefault();

        if (typeof this.passCodeSubmit === "function") {
            const passCode = this.inputPassCode.value;
            this.passCodeSubmit(passCode);
        }
    }

    image_delete_click(fileName, messageBoxId, event) {
        event.preventDefault();

        const isDelete = confirm(`Are you sure you want to permanently delete the "${fileName}" file?`);
        if (isDelete) {
            if (typeof this.deleteImage === "function") {
                this.deleteImage(fileName, messageBoxId);
            }
        }
    }

    removeMessage_click(messageBoxId, event) {
        event.preventDefault();

        this.removeMessageBox(messageBoxId);
    }
}
