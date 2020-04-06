"use strict";

const { Command } = require("../command");
const requireInstance = require("../requireInstance");
const { requirePermissions } = require("../requirePermissions");
const request = require("request");
const api = require("../api");
const responseToError = require("../responseToError");
const { FirebaseError } = require("../error");

const utils = require("../utils");
const clc = require("cli-color");
const logger = require("../logger");
const fs = require("fs");
const { prompt } = require("../prompt");
const _ = require("lodash");

module.exports = new Command("database:update <path> [infile]")
  .description("update some of the keys for the defined path in your Firebase")
  .option("-d, --data <data>", "specify escaped JSON directly")
  .option("-y, --confirm", "pass this option to bypass confirmation prompt")
  .option(
    "--instance <instance>",
    "use the database <instance>.firebaseio.com (if omitted, use default database instance)"
  )
  .before(requirePermissions, ["firebasedatabase.instances.update"])
  .before(requireInstance)
  .action(function(path, infile, options) {
    if (!_.startsWith(path, "/")) {
      return utils.reject("Path must begin with /", { exit: 1 });
    }

    return prompt(options, [
      {
        type: "confirm",
        name: "confirm",
        default: false,
        message:
          "You are about to modify data at " +
          clc.cyan(utils.addSubdomain(api.realtimeOrigin, options.instance) + path) +
          ". Are you sure?",
      },
    ]).then(function() {
      if (!options.confirm) {
        return utils.reject("Command aborted.", { exit: 1 });
      }

      const inStream =
        utils.stringToStream(options.data) ||
        (infile ? fs.createReadStream(infile) : process.stdin);
      const url = utils.addSubdomain(api.realtimeOrigin, options.instance) + path + ".json?";

      if (!infile && !options.data) {
        utils.explainStdin();
      }

      const reqOptions = {
        url: url,
        json: true,
      };

      return api.addRequestHeaders(reqOptions).then(function(reqOptionsWithToken) {
        return new Promise(function(resolve, reject) {
          inStream.pipe(
            request.patch(reqOptionsWithToken, function(err, res, body) {
              logger.info();
              if (err) {
                return reject(
                  new FirebaseError("Unexpected error while setting data", {
                    exit: 2,
                  })
                );
              } else if (res.statusCode >= 400) {
                return reject(responseToError(res, body));
              }

              utils.logSuccess("Data updated successfully");
              logger.info();
              logger.info(
                clc.bold("View data at:"),
                utils.consoleUrl(options.project, "/database/data" + path)
              );
              return resolve();
            })
          );
        });
      });
    });
  });
