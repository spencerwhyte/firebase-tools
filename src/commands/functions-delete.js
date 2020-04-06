"use strict";

const _ = require("lodash");

const { Command } = require("../command");
const clc = require("cli-color");
const cloudfunctions = require("../gcp/cloudfunctions");
const functionsConfig = require("../functionsConfig");
const functionsDelete = require("../functionsDelete");
const getProjectId = require("../getProjectId");
const helper = require("../functionsDeployHelper");
const { prompt } = require("../prompt");
const { requirePermissions } = require("../requirePermissions");
const utils = require("../utils");

module.exports = new Command("functions:delete [filters...]")
  .description("delete one or more Cloud Functions by name or group name.")
  .option(
    "--region <region>",
    "Specify region of the function to be deleted. " +
      "If omitted, functions from all regions whose names match the filters will be deleted. "
  )
  .option("-f, --force", "No confirmation. Otherwise, a confirmation prompt will appear.")
  .before(requirePermissions, ["cloudfunctions.functions.list", "cloudfunctions.functions.delete"])
  .action(function(filters, options) {
    if (!filters.length) {
      return utils.reject("Must supply at least function or group name.");
    }

    const projectId = getProjectId(options);
    let appEngineLocation;
    let functionsToDelete = [];

    // Dot notation can be used to indicate function inside of a group
    const filterChunks = _.map(filters, function(filter) {
      return filter.split(".");
    });
    return functionsConfig
      .getFirebaseConfig(options)
      .then((config) => {
        appEngineLocation = functionsConfig.getAppEngineLocation(config);
      })
      .then(() => {
        return cloudfunctions
          .listAll(projectId)
          .then(function(result) {
            const allFunctions = _.map(result, "name");
            return _.filter(allFunctions, function(name) {
              const regionMatches = options.region
                ? helper.getRegion(name) === options.region
                : true;
              const nameMatches = _.some(
                _.map(filterChunks, function(chunk) {
                  return helper.functionMatchesGroup(name, chunk);
                })
              );
              return regionMatches && nameMatches;
            });
          })
          .then(function(result) {
            functionsToDelete = result;
            if (functionsToDelete.length === 0) {
              return utils.reject(
                "The specified filters do not match any existing functions in project " +
                  clc.bold(projectId) +
                  ".",
                { exit: 1 }
              );
            }
            const deleteList = _.map(functionsToDelete, function(func) {
              return "\t" + helper.getFunctionLabel(func);
            }).join("\n");
            if (!options.force) {
              return prompt(options, [
                {
                  type: "confirm",
                  name: "confirm",
                  default: false,
                  message:
                    "You are about to delete the following Cloud Functions:\n" +
                    deleteList +
                    "\n  Are you sure?",
                },
              ]);
            }
          })
          .then(function() {
            if (!(options.confirm || options.force)) {
              return utils.reject("Command aborted.", { exit: 1 });
            }
            return functionsDelete(functionsToDelete, projectId, appEngineLocation);
          });
      });
  });
