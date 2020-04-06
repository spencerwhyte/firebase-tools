"use strict";

const clc = require("cli-color");
const fs = require("fs");

const api = require("./api");
const utils = require("./utils");

const prepareFirebaseRules = function(component, options, payload) {
  const rulesFileName = component + ".rules";
  let rulesPath = options.config.get(rulesFileName);
  if (rulesPath) {
    rulesPath = options.config.path(rulesPath);
    const src = fs.readFileSync(rulesPath, "utf8");
    utils.logBullet(clc.bold.cyan(component + ":") + " checking rules for compilation errors...");
    return api
      .request("POST", "/v1/projects/" + encodeURIComponent(options.project) + ":test", {
        origin: api.rulesOrigin,
        data: {
          source: {
            files: [
              {
                content: src,
                name: rulesFileName,
              },
            ],
          },
        },
        auth: true,
      })
      .then(function(response) {
        if (response.body && response.body.issues && response.body.issues.length > 0) {
          const add = response.body.issues.length === 1 ? "" : "s";
          let message =
            "Compilation error" +
            add +
            " in " +
            clc.bold(options.config.get(rulesFileName)) +
            ":\n";
          response.body.issues.forEach(function(issue) {
            message +=
              "\n[" +
              issue.severity.substring(0, 1) +
              "] " +
              issue.sourcePosition.line +
              ":" +
              issue.sourcePosition.column +
              " - " +
              issue.description;
          });

          return utils.reject(message, { exit: 1 });
        }

        utils.logSuccess(clc.bold.green(component + ":") + " rules file compiled successfully");
        payload[component] = {
          rules: [{ name: options.config.get(rulesFileName), content: src }],
        };
        return Promise.resolve();
      });
  }

  return Promise.resolve();
};

module.exports = prepareFirebaseRules;
