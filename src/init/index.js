"use strict";

const _ = require("lodash");
const clc = require("cli-color");

const logger = require("../logger");
const features = require("./features");
const utils = require("../utils");

var init = function(setup, config, options) {
  const nextFeature = setup.features.shift();
  if (nextFeature) {
    if (!features[nextFeature]) {
      return utils.reject(
        clc.bold(nextFeature) +
          " is not a valid feature. Must be one of " +
          _.without(_.keys(features), "project").join(", ")
      );
    }

    logger.info(clc.bold("\n" + clc.white("=== ") + _.capitalize(nextFeature) + " Setup"));
    return Promise.resolve(features[nextFeature](setup, config, options)).then(function() {
      return init(setup, config, options);
    });
  }
  return Promise.resolve();
};

module.exports = init;
