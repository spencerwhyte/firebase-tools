"use strict";

const _ = require("lodash");
const clc = require("cli-color");
const path = require("path");

const semver = require("semver");
const spawn = require("cross-spawn");

const utils = require("./utils");
const logger = require("./logger");

module.exports = function(options) {
  return new Promise(function(resolve) {
    if (!options.config.has("functions")) {
      return resolve();
    }
    try {
      let output;
      const child = spawn("npm", ["outdated", "firebase-functions", "--json=true"], {
        cwd: path.join(options.config.projectDir, options.config.get("functions.source")),
        stdio: [0, "pipe", 2],
      });

      child.on("error", function(err) {
        logger.debug(err.stack);
        return resolve();
      });

      child.stdout.on("data", function(data) {
        output = JSON.parse(data.toString("utf8"));
      });

      child.on("exit", function() {
        return resolve(output);
      });
    } catch (e) {
      resolve();
    }
  }).then(function(output) {
    if (!output || _.isEmpty(output)) {
      return;
    }
    const wanted = output["firebase-functions"].wanted;
    const latest = output["firebase-functions"].latest;

    try {
      if (semver.lt(wanted, latest)) {
        utils.logWarning(
          clc.bold.yellow("functions: ") +
            "package.json indicates an outdated version of firebase-functions.\n Please upgrade using " +
            clc.bold("npm install --save firebase-functions@latest") +
            " in your functions directory."
        );
        if (semver.satisfies(wanted, "0.x") && semver.satisfies(latest, "1.x")) {
          utils.logWarning(
            clc.bold.yellow("functions: ") +
              "Please note that there will be breaking changes when you upgrade.\n Go to " +
              clc.bold("https://firebase.google.com/docs/functions/beta-v1-diff") +
              " to learn more."
          );
        }
      }
    } catch (e) {
      // do nothing
    }
  });
};
