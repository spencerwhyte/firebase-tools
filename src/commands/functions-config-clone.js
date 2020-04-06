"use strict";

const clc = require("cli-color");
const { Command } = require("../command");
const functionsConfig = require("../functionsConfig");
const functionsConfigClone = require("../functionsConfigClone");
const getProjectId = require("../getProjectId");
const { requirePermissions } = require("../requirePermissions");
const utils = require("../utils");
const logger = require("../logger");

module.exports = new Command("functions:config:clone")
  .description("clone environment config from another project")
  .option("--from <projectId>", "the project from which to clone configuration")
  .option("--only <keys>", "a comma-separated list of keys to clone")
  .option("--except <keys>", "a comma-separated list of keys to not clone")
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
  .action(function(options) {
    const projectId = getProjectId(options);
    if (!options.from) {
      return utils.reject(
        "Must specify a source project in " + clc.bold("--from <projectId>") + " option."
      );
    } else if (options.from === projectId) {
      return utils.reject("From project and destination can't be the same project.");
    } else if (options.only && options.except) {
      return utils.reject("Cannot use both --only and --except at the same time.");
    }

    let only;
    let except;
    if (options.only) {
      only = options.only.split(",");
    } else if (options.except) {
      except = options.except.split(",");
    }

    return functionsConfigClone(options.from, projectId, only, except).then(function() {
      utils.logSuccess(
        "Cloned functions config from " + clc.bold(options.from) + " into " + clc.bold(projectId)
      );
      logger.info(
        "\nPlease deploy your functions for the change to take effect by running " +
          clc.bold("firebase deploy --only functions") +
          "\n"
      );
    });
  });
