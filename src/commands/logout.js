"use strict";

const { Command } = require("../command");
const { configstore } = require("../configstore");
const logger = require("../logger");
const clc = require("cli-color");

const utils = require("../utils");
const api = require("../api");
const auth = require("../auth");
const _ = require("lodash");

module.exports = new Command("logout")
  .description("log the CLI out of Firebase")
  .action(function(options) {
    const user = configstore.get("user");
    const tokens = configstore.get("tokens");
    const currentToken = _.get(tokens, "refresh_token");
    const token = utils.getInheritedOption(options, "token") || currentToken;
    api.setRefreshToken(token);
    let next;
    if (token) {
      next = auth.logout(token);
    } else {
      next = Promise.resolve();
    }

    const cleanup = function() {
      if (token || user || tokens) {
        let msg = "Logged out";
        if (token === currentToken) {
          if (user) {
            msg += " from " + clc.bold(user.email);
          }
        } else {
          msg += ' token "' + clc.bold(token) + '"';
        }
        utils.logSuccess(msg);
      } else {
        logger.info("No need to logout, not logged in");
      }
    };

    return next.then(cleanup, function() {
      utils.logWarning("Invalid refresh token, did not need to deauthorize");
      cleanup();
    });
  });
