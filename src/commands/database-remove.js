"use strict";

const { Command } = require("../command");
const requireInstance = require("../requireInstance");
const { requirePermissions } = require("../requirePermissions");
const DatabaseRemove = require("../database/remove").default;
const api = require("../api");

const utils = require("../utils");
const { prompt } = require("../prompt");
const clc = require("cli-color");
const _ = require("lodash");

module.exports = new Command("database:remove <path>")
  .description("remove data from your Firebase at the specified path")
  .option("-y, --confirm", "pass this option to bypass confirmation prompt")
  .option(
    "--instance <instance>",
    "use the database <instance>.firebaseio.com (if omitted, use default database instance)"
  )
  .before(requirePermissions, ["firebasedatabase.instances.update"])
  .before(requireInstance)
  .action(function(path, options) {
    if (!_.startsWith(path, "/")) {
      return utils.reject("Path must begin with /", { exit: 1 });
    }

    return prompt(options, [
      {
        type: "confirm",
        name: "confirm",
        default: false,
        message:
          "You are about to remove all data at " +
          clc.cyan(utils.addSubdomain(api.realtimeOrigin, options.instance) + path) +
          ". Are you sure?",
      },
    ]).then(function() {
      if (!options.confirm) {
        return utils.reject("Command aborted.", { exit: 1 });
      }
      const removeOps = new DatabaseRemove(options.instance, path);
      return removeOps.execute().then(function() {
        utils.logSuccess("Data removed successfully");
      });
    });
  });
