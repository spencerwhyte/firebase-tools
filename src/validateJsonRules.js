"use strict";

const cjson = require("cjson");
const _ = require("lodash");

module.exports = function(rules) {
  const parsed = cjson.parse(rules);
  return _.has(parsed, "rules");
};
