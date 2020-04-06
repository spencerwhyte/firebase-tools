"use strict";

const clc = require("cli-color");

const { Command } = require("../command");
const requireConfig = require("../requireConfig");
const utils = require("../utils");

module.exports = new Command("target:remove <type> <resource>")
  .description("remove a resource target")
  .before(requireConfig)
  .action(function(type, resource, options) {
    const name = options.rc.removeTarget(options.project, type, resource);
    if (name) {
      utils.logSuccess(
        "Removed " + type + " target " + clc.bold(name) + " from " + clc.bold(resource)
      );
    } else {
      utils.logWarning(
        "No action taken. No target found for " + type + " resource " + clc.bold(resource)
      );
    }
    return Promise.resolve(name);
  });
