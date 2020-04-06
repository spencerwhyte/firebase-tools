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
const _ = require("lodash");

module.exports = new Command("database:push <path> [infile]")
  .description("add a new JSON object to a list of data in your Firebase")
  .option("-d, --data <data>", "specify escaped JSON directly")
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

    const inStream =
      utils.stringToStream(options.data) || (infile ? fs.createReadStream(infile) : process.stdin);
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
          request.post(reqOptionsWithToken, function(err, res, body) {
            logger.info();
            if (err) {
              return reject(
                new FirebaseError("Unexpected error while pushing data", {
                  exit: 2,
                })
              );
            } else if (res.statusCode >= 400) {
              return reject(responseToError(res, body));
            }

            if (!_.endsWith(path, "/")) {
              path += "/";
            }

            const consoleUrl = utils.consoleUrl(
              options.project,
              "/database/data" + path + body.name
            );

            utils.logSuccess("Data pushed successfully");
            logger.info();
            logger.info(clc.bold("View data at:"), consoleUrl);
            return resolve({ key: body.name });
          })
        );
      });
    });
  });
