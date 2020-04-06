"use strict";

const api = require("./api");
const { FirebaseError } = require("./error");
const utils = require("./utils");

exports.updateRules = function(instance, src, options) {
  options = options || {};
  let url = "/.settings/rules.json";
  if (options.dryRun) {
    url += "?dryRun=true";
  }

  return api
    .request("PUT", url, {
      origin: utils.addSubdomain(api.realtimeOrigin, instance),
      auth: true,
      data: src,
      json: false,
      resolveOnHTTPError: true,
    })
    .then(function(response) {
      if (response.status === 400) {
        throw new FirebaseError(
          "Syntax error in database rules:\n\n" + JSON.parse(response.body).error
        );
      } else if (response.status > 400) {
        throw new FirebaseError("Unexpected error while deploying database rules.", { exit: 2 });
      }
    });
};
