"use strict";

class IoService {
    static postData(url, data, headers, callback) {
        const httpRequest = new XMLHttpRequest();
        httpRequest.open("POST", url, true);

        for (let i = 0; i < headers.length; i++) {
            httpRequest.setRequestHeader(headers[i].header, headers[i].value);
        }

        httpRequest.onload = httpRequest_load;
        httpRequest.onerror = httpRequest_error;
        httpRequest.send(data);

        function httpRequest_load() {
            try {
                const res = httpRequest.responseText;
                const isErrDataJson = /^{"err":.+"data":.+}$/.test(res);
                if (isErrDataJson) {
                    const response = JSON.parse(res);
                    callback(response.err, response.data);
                }
                else {
                    callback(null, res);
                }
            }
            catch (e) {
                callback(e.toString(), null);
            }
        }

        function httpRequest_error() {
            callback("An error occurred during the transaction.", null);
        }
    }
}
