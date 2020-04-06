"use strict";

const clc = require("cli-color");

const rtdb = require("../../rtdb");
const utils = require("../../utils");

module.exports = function(context) {
  if (!context.database || !context.database.deploys || !context.database.ruleFiles) {
    return Promise.resolve();
  }

  const deploys = context.database.deploys;
  const ruleFiles = context.database.ruleFiles;

  utils.logBullet(clc.bold.cyan("database: ") + "releasing rules...");
  return Promise.all(
    deploys.map(function(deploy) {
      return rtdb
        .updateRules(deploy.instance, ruleFiles[deploy.rules], {
          dryRun: false,
        })
        .then(function() {
          utils.logSuccess(
            clc.bold.green("database: ") +
              "rules for database " +
              clc.bold(deploy.instance) +
              " released successfully"
          );
        });
    })
  );
};
