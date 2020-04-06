"use strict";

const clc = require("cli-color");
const api = require("../../api");
const { prompt, promptOnce } = require("../../prompt");
const logger = require("../../logger");
const utils = require("../../utils");
const fsutils = require("../../fsutils");

const defaultRules = JSON.stringify(
  { rules: { ".read": "auth != null", ".write": "auth != null" } },
  null,
  2
);

const _getDBRules = function(instance) {
  if (!instance) {
    return Promise.resolve(defaultRules);
  }
  return api
    .request("GET", "/.settings/rules.json", {
      auth: true,
      origin: utils.addSubdomain(api.realtimeOrigin, instance),
    })
    .then(function(response) {
      return response.body;
    });
};

const _writeDBRules = function(instance, filename, config) {
  return _getDBRules(instance)
    .then(function(rules) {
      return config.writeProjectFile(filename, rules);
    })
    .then(function() {
      utils.logSuccess(
        "Database Rules for " +
          clc.bold(instance) +
          " have been downloaded to " +
          clc.bold(filename) +
          "."
      );
      logger.info(
        "Future modifications to " + clc.bold(filename) + " will update Database Rules when you run"
      );
      logger.info(clc.bold("firebase deploy") + ".");
    });
};

module.exports = function(setup, config) {
  setup.config.database = {};
  const instance = setup.instance;
  let filename = null;

  logger.info();
  logger.info("Firebase Realtime Database Rules allow you to define how your data should be");
  logger.info("structured and when your data can be read from and written to.");
  logger.info();

  return prompt(setup.config.database, [
    {
      type: "input",
      name: "rules",
      message: "What file should be used for Database Rules?",
      default: "database.rules.json",
    },
  ])
    .then(function() {
      filename = setup.config.database.rules;

      if (fsutils.fileExistsSync(filename)) {
        const msg =
          "File " +
          clc.bold(filename) +
          " already exists." +
          " Do you want to overwrite it with the Database Rules for " +
          clc.bold(instance) +
          " from the Firebase Console?";
        return promptOnce({
          type: "confirm",
          message: msg,
          default: false,
        });
      }
      return Promise.resolve(true);
    })
    .then(function(overwrite) {
      if (overwrite) {
        return _writeDBRules(instance, filename, config);
      }
      logger.info("Skipping overwrite of Database Rules.");
      logger.info(
        "The rules defined in " +
          clc.bold(filename) +
          " will be published when you do " +
          clc.bold("firebase deploy") +
          "."
      );
      return Promise.resolve();
    });
};
