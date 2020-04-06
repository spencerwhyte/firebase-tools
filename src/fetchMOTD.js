"use strict";
const logger = require("./logger");
const request = require("request");
const { configstore } = require("./configstore");
const _ = require("lodash");
const pkg = require("../package.json");
const semver = require("semver");
const clc = require("cli-color");
const utils = require("./utils");
const api = require("./api");

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

module.exports = function() {
  let motd = configstore.get("motd");
  const motdFetched = configstore.get("motd.fetched") || 0;

  if (motd && motdFetched > Date.now() - ONE_DAY_MS) {
    if (motd.minVersion && semver.gt(motd.minVersion, pkg.version)) {
      logger.error(
        clc.red("Error:"),
        "CLI is out of date (on",
        clc.bold(pkg.version),
        ", need at least",
        clc.bold(motd.minVersion) + ")\n\nRun",
        clc.bold("npm install -g firebase-tools"),
        "to upgrade."
      );
      process.exit(1);
    }

    if (motd.message && process.stdout.isTTY) {
      const lastMessage = configstore.get("motd.lastMessage");
      if (lastMessage !== motd.message) {
        logger.info();
        logger.info(motd.message);
        logger.info();
        configstore.set("motd.lastMessage", motd.message);
      }
    }
  } else {
    request(
      {
        url: utils.addSubdomain(api.realtimeOrigin, "firebase-public") + "/cli.json",
        json: true,
      },
      function(err, res, body) {
        if (err) {
          return;
        }
        motd = _.assign({}, body);
        configstore.set("motd", motd);
        configstore.set("motd.fetched", Date.now());
      }
    );
  }
};
