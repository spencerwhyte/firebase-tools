"use strict";

const clc = require("cli-color");

const { Command } = require("../command");
const requireConfig = require("../requireConfig");
const utils = require("../utils");

module.exports = new Command("target:clear <type> <target>")
  .description("clear all resources from a named resource target")
  .before(requireConfig)
  .action(function(type, name, options) {
    const existed = options.rc.clearTarget(options.project, type, name);
    if (existed) {
      utils.logSuccess("Cleared " + type + " target " + clc.bold(name));
    } else {
      utils.logWarning("No action taken. No " + type + " target found named " + clc.bold(name));
    }
    return Promise.resolve(existed);
  });
