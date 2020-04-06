"use strict";

const _ = require("lodash");
const clc = require("cli-color");
const path = require("path");

const { FirebaseError } = require("../../error");
const parseBoltRules = require("../../parseBoltRules");
const rtdb = require("../../rtdb");
const utils = require("../../utils");

module.exports = function(context, options) {
  let rulesConfig = options.config.get("database");
  const next = Promise.resolve();

  if (!rulesConfig) {
    return next;
  }

  if (_.isString(_.get(rulesConfig, "rules"))) {
    rulesConfig = [_.assign(rulesConfig, { instance: options.instance })];
  }

  const ruleFiles = {};
  let deploys = [];

  rulesConfig.forEach(function(ruleConfig) {
    if (!ruleConfig.rules) {
      return;
    }

    ruleFiles[ruleConfig.rules] = null;

    if (ruleConfig.target) {
      options.rc.requireTarget(context.projectId, "database", ruleConfig.target);
      const instances = options.rc.target(context.projectId, "database", ruleConfig.target);
      deploys = deploys.concat(
        instances.map(function(inst) {
          return { instance: inst, rules: ruleConfig.rules };
        })
      );
    } else if (!ruleConfig.instance) {
      throw new FirebaseError('Must supply either "target" or "instance" in database config');
    } else {
      deploys.push(ruleConfig);
    }
  });

  _.forEach(ruleFiles, function(v, file) {
    switch (path.extname(file)) {
      case ".json":
        ruleFiles[file] = options.config.readProjectFile(file);
        break;
      case ".bolt":
        ruleFiles[file] = parseBoltRules(file);
        break;
      default:
        throw new FirebaseError("Unexpected rules format " + path.extname(file));
    }
  });

  context.database = {
    deploys: deploys,
    ruleFiles: ruleFiles,
  };
  utils.logBullet(clc.bold.cyan("database: ") + "checking rules syntax...");
  return Promise.all(
    deploys.map(function(deploy) {
      return rtdb
        .updateRules(deploy.instance, ruleFiles[deploy.rules], { dryRun: true })
        .then(function() {
          utils.logSuccess(
            clc.bold.green("database: ") +
              "rules syntax for database " +
              clc.bold(deploy.instance) +
              " is valid"
          );
        });
    })
  );
};
