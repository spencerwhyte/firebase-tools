"use strict";

const clc = require("cli-color");

const { Command } = require("../command");
const getProjectId = require("../getProjectId");
const { requirePermissions } = require("../requirePermissions");
const logger = require("../logger");
const utils = require("../utils");
const functionsConfig = require("../functionsConfig");

module.exports = new Command("functions:config:set [values...]")
  .description("set environment config with key=value syntax")
  .before(requirePermissions, [
    "runtimeconfig.configs.list",
    "runtimeconfig.configs.create",
    "runtimeconfig.configs.get",
    "runtimeconfig.configs.update",
    "runtimeconfig.configs.delete",
    "runtimeconfig.variables.list",
    "runtimeconfig.variables.create",
    "runtimeconfig.variables.get",
    "runtimeconfig.variables.update",
    "runtimeconfig.variables.delete",
  ])
  .before(functionsConfig.ensureApi)
  .action(function(args, options) {
    if (!args.length) {
      return utils.reject(
        "Must supply at least one key/value pair, e.g. " + clc.bold('app.name="My App"')
      );
    }
    const projectId = getProjectId(options);
    const parsed = functionsConfig.parseSetArgs(args);
    const promises = [];

    parsed.forEach(function(item) {
      promises.push(
        functionsConfig.setVariablesRecursive(projectId, item.configId, item.varId, item.val)
      );
    });

    return Promise.all(promises).then(function() {
      utils.logSuccess("Functions config updated.");
      logger.info(
        "\nPlease deploy your functions for the change to take effect by running " +
          clc.bold("firebase deploy --only functions") +
          "\n"
      );
    });
  });
