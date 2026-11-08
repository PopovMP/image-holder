"use strict";

class IoService {
    /**
     * POSTs JSON and hands back ({err, data}) parsed from the response.
     * @param {string} url
     * @param {string} data
     * @param {Array<{header: string, value: string}>} headers
     * @param {function} callback
     */
    static postData(url, data, headers, callback) {
        const httpRequest = new XMLHttpRequest();

        httpRequest.open("POST", url, true);

        // Proves to the server that this is a scripted same-origin call, not a
        // cross-site form submission.
        httpRequest.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        httpRequest.setRequestHeader("Accept", "application/json");

        for (let i = 0; i < headers.length; i++) {
            httpRequest.setRequestHeader(headers[i].header, headers[i].value);
        }

        httpRequest.onload = httpRequest_load;
        httpRequest.onerror = httpRequest_error;
        httpRequest.send(data);

        function httpRequest_load() {
            if (httpRequest.status === 401) {
                window.location.href = "login";
                return;
            }

            let response;

            try {
                response = JSON.parse(httpRequest.responseText);
            } catch (e) {
                callback("Unexpected server response.", null);
                return;
            }

            if (response && response.err) {
                callback(typeof response.err === "string" ? response.err : "Unexpected error.", null);
                return;
            }

            callback(null, response ? response.data : null);
        }

        function httpRequest_error() {
            callback("An error occurred during the transaction.", null);
        }
    }
}
