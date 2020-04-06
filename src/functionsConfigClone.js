"use strict";

const _ = require("lodash");

const clc = require("cli-color");
const { FirebaseError } = require("./error");
const functionsConfig = require("./functionsConfig");
const runtimeconfig = require("./gcp/runtimeconfig");

// Tests whether short is a prefix of long
const _matchPrefix = function(short, long) {
  if (short.length > long.length) {
    return false;
  }
  return _.reduce(
    short,
    function(accum, x, i) {
      return accum && x === long[i];
    },
    true
  );
};

const _applyExcept = function(json, except) {
  _.forEach(except, function(key) {
    _.unset(json, key);
  });
};

const _cloneVariable = function(varName, toProject) {
  return runtimeconfig.variables.get(varName).then(function(variable) {
    const id = functionsConfig.varNameToIds(variable.name);
    return runtimeconfig.variables.set(toProject, id.config, id.variable, variable.text);
  });
};

const _cloneConfig = function(configName, toProject) {
  return runtimeconfig.variables.list(configName).then(function(variables) {
    return Promise.all(
      _.map(variables, function(variable) {
        return _cloneVariable(variable.name, toProject);
      })
    );
  });
};

const _cloneConfigOrVariable = function(key, fromProject, toProject) {
  const parts = key.split(".");
  if (_.includes(exports.RESERVED_NAMESPACES, parts[0])) {
    throw new FirebaseError("Cannot clone reserved namespace " + clc.bold(parts[0]));
  }
  const configName = _.join(["projects", fromProject, "configs", parts[0]], "/");
  if (parts.length === 1) {
    return _cloneConfig(configName, toProject);
  }
  return runtimeconfig.variables.list(configName).then(function(variables) {
    const promises = [];
    _.forEach(variables, function(variable) {
      const varId = functionsConfig.varNameToIds(variable.name).variable;
      const variablePrefixFilter = parts.slice(1);
      if (_matchPrefix(variablePrefixFilter, varId.split("/"))) {
        promises.push(_cloneVariable(variable.name, toProject));
      }
    });
    return Promise.all(promises);
  });
};

module.exports = function(fromProject, toProject, only, except) {
  except = except || [];

  if (only) {
    return Promise.all(
      _.map(only, function(key) {
        return _cloneConfigOrVariable(key, fromProject, toProject);
      })
    );
  }
  return functionsConfig.materializeAll(fromProject).then(function(toClone) {
    _.unset(toClone, "firebase"); // Do not clone firebase config
    _applyExcept(toClone, except);
    return Promise.all(
      _.map(toClone, function(val, configId) {
        return functionsConfig.setVariablesRecursive(toProject, configId, "", val);
      })
    );
  });
};
