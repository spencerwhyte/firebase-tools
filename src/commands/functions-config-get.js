"use strict";

const _ = require("lodash");
const { Command } = require("../command");
const getProjectId = require("../getProjectId");
const logger = require("../logger");
const { requirePermissions } = require("../requirePermissions");
const functionsConfig = require("../functionsConfig");

function _materialize(projectId, path) {
  if (_.isUndefined(path)) {
    return functionsConfig.materializeAll(projectId);
  }
  const parts = path.split(".");
  const configId = parts[0];
  const configName = _.join(["projects", projectId, "configs", configId], "/");
  return functionsConfig.materializeConfig(configName, {}).then(function(result) {
    const query = _.chain(parts)
      .join(".")
      .value();
    return query ? _.get(result, query) : result;
  });
}

module.exports = new Command("functions:config:get [path]")
  .description("fetch environment config stored at the given path")
  .before(requirePermissions, [
    "runtimeconfig.configs.list",
    "runtimeconfig.configs.get",
    "runtimeconfig.variables.list",
    "runtimeconfig.variables.get",
  ])
  .before(functionsConfig.ensureApi)
  .action(function(path, options) {
    return _materialize(getProjectId(options), path).then(function(result) {
      logger.info(JSON.stringify(result, null, 2));
      return result;
    });
  });
