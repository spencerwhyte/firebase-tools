"use strict";

const fs = require("fs");
const _ = require("lodash");
const ora = require("ora");
const readline = require("readline");
const request = require("request");

const tmp = require("tmp");

const api = require("./api");
const utils = require("./utils");
const ProfileReport = require("./profileReport");
const { FirebaseError } = require("./error");
const responseToError = require("./responseToError");

module.exports = function(options) {
  const url = utils.addSubdomain(api.realtimeOrigin, options.instance) + "/.settings/profile.json?";

  const rl = readline.createInterface({
    input: process.stdin,
  });

  const reqOptions = {
    url: url,
    headers: {
      Accept: "text/event-stream",
    },
  };

  return api.addRequestHeaders(reqOptions).then(function(reqOptionsWithToken) {
    return new Promise(function(resolve, reject) {
      const fileOut = !!options.output;
      const tmpFile = tmp.tmpNameSync();
      const tmpStream = fs.createWriteStream(tmpFile);
      const outStream = fileOut ? fs.createWriteStream(options.output) : process.stdout;
      let counter = 0;
      const spinner = ora({
        text: "0 operations recorded. Press [enter] to stop",
        color: "yellow",
      });
      const outputFormat = options.raw ? "RAW" : options.parent.json ? "JSON" : "TXT"; // eslint-disable-line no-nested-ternary
      let erroring;
      let errorResponse = "";
      let response;

      const generateReport = _.once(function() {
        rl.close();
        spinner.stop();
        if (erroring) {
          fs.unlinkSync(tmpFile);
          try {
            const data = JSON.parse(errorResponse);
            return reject(responseToError(response, data));
          } catch (e) {
            // If it wasn't JSON, then it was a text response, technically it should always
            // a text response because of the Accept header we set, but you never know.
            // Examples of errors here is the popular "Permission Denied".
            return reject(
              new FirebaseError(errorResponse, {
                exit: 2,
              })
            );
          }
        } else if (response) {
          response.destroy();
          response = null;
        }
        const dataFile = options.input || tmpFile;
        const reportOptions = {
          format: outputFormat,
          isFile: fileOut,
          isInput: !!options.input,
          collapse: options.collapse,
        };
        const report = new ProfileReport(dataFile, outStream, reportOptions);
        report.generate().then(
          function(result) {
            fs.unlinkSync(tmpFile);
            resolve(result);
          },
          function(e) {
            reject(e);
          }
        );
      });

      if (options.input) {
        // If there is input, don't contact the server
        return generateReport();
      }

      request
        .get(reqOptionsWithToken)
        .on("response", function(res) {
          response = res;
          if (response.statusCode >= 400) {
            erroring = true;
          } else if (!_.has(options, "duration")) {
            spinner.start();
          }
        })
        .on("data", function(chunk) {
          if (erroring) {
            errorResponse += chunk.toString();
            return;
          }
          tmpStream.write(chunk);
          if (chunk.toString().indexOf("event: log") >= 0) {
            counter++;
            spinner.text = counter + " operations recorded. Press [enter] to stop";
          }
        })
        .on("end", function() {
          spinner.text = counter + " operations recorded.\n";
          generateReport();
        })
        .on("error", function() {
          spinner.text = counter + " operations recorded.\n";
          erroring = true;
          generateReport();
        });

      if (_.has(options, "duration")) {
        setTimeout(generateReport, options.duration * 1000);
      } else {
        // On newline, generate the report.
        rl.question("", generateReport);
      }
    });
  });
};
