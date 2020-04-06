"use strict";

const { Command } = require("../command");
const requireInstance = require("../requireInstance");
const { requirePermissions } = require("../requirePermissions");
const api = require("../api");
const utils = require("../utils");
const { prompt } = require("../prompt");
const clc = require("cli-color");

module.exports = new Command("hosting:disable")
  .description("stop serving web traffic to your Firebase Hosting site")
  .option("-y, --confirm", "skip confirmation")
  .option("-s, --site <site_name>", "the site to disable")
  .before(requirePermissions, ["firebasehosting.sites.update"])
  .before(requireInstance)
  .action(function(options) {
    return prompt(options, [
      {
        type: "confirm",
        name: "confirm",
        message:
          "Are you sure you want to disable Firebase Hosting?\n  " +
          clc.bold.underline("This will immediately make your site inaccessible!"),
      },
    ])
      .then(function() {
        if (!options.confirm) {
          return Promise.resolve();
        }

        return api.request("POST", `/v1beta1/sites/${options.site || options.instance}/releases`, {
          auth: true,
          data: {
            type: "SITE_DISABLE",
          },
          origin: api.hostingApiOrigin,
        });
      })
      .then(function() {
        if (options.confirm) {
          utils.logSuccess(
            "Hosting has been disabled for " +
              clc.bold(options.project) +
              ". Deploy a new version to re-enable."
          );
        }
      });
  });
