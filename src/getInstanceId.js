"use strict";

const _ = require("lodash");
const { getFirebaseProject } = require("./management/projects");
const logger = require("./logger");

/**
 * Tries to determine the instance ID for the provided
 * project.
 * @param {Object} options The command-line options object
 * @returns {Promise<String>} The instance ID
 */
module.exports = function(options) {
  return getFirebaseProject(options.project).then(function(project) {
    if (!_.has(project, "resources.realtimeDatabaseInstance")) {
      logger.debug(
        "[WARNING] Unable to fetch default resources. Falling back to project id (" +
          options.project +
          ")"
      );
      return options.project;
    }

    return _.get(project, "resources.realtimeDatabaseInstance");
  });
};
