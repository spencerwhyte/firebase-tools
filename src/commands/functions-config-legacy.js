"use strict";

const _ = require("lodash");

const { Command } = require("../command");
const getProjectId = require("../getProjectId");
const { requirePermissions } = require("../requirePermissions");
const runtimeconfig = require("../gcp/runtimeconfig");
const functionsConfig = require("../functionsConfig");
const logger = require("../logger");

module.exports = new Command("functions:config:legacy")
  .description("get legacy functions config variables")
  .before(requirePermissions, [
    "runtimeconfig.configs.list",
    "runtimeconfig.configs.get",
    "runtimeconfig.variables.list",
    "runtimeconfig.variables.get",
  ])
  .action(function(options) {
    const projectId = getProjectId(options);
    const metaPath = "projects/" + projectId + "/configs/firebase/variables/meta";
    return runtimeconfig.variables
      .get(metaPath)
      .then(function(result) {
        const metaVal = JSON.parse(result.text);
        if (!_.has(metaVal, "version")) {
          logger.info("You do not have any legacy config variables.");
          return null;
        }
        const latestVarPath = functionsConfig.idsToVarName(projectId, "firebase", metaVal.version);
        return runtimeconfig.variables.get(latestVarPath);
      })
      .then(function(latest) {
        if (latest !== null) {
          const latestVal = JSON.parse(latest.text);
          logger.info(JSON.stringify(latestVal, null, 2));
          return latestVal;
        }
      })
      .catch(function(err) {
        if (_.get(err, "context.response.statusCode") === 404) {
          logger.info("You do not have any legacy config variables.");
          return null;
        }
        return Promise.reject(err);
      });
  });
