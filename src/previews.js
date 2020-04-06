"use strict";

let _ = require("lodash");
let { configstore } = require("./configstore");

let previews = _.assign(
  {
    // insert previews here...
    rtdbrules: false,
    ext: false,
    extdev: false,
    emulatorgui: false,
  },
  configstore.get("previews")
);

if (process.env.FIREBASE_CLI_PREVIEWS) {
  process.env.FIREBASE_CLI_PREVIEWS.split(",").forEach(function(feature) {
    if (_.has(previews, feature)) {
      _.set(previews, feature, true);
    }
  });
}

module.exports = previews;
