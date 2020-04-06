"use strict";

const _ = require("lodash");
const clc = require("cli-color");
const cjson = require("cjson");
const fs = require("fs");
const path = require("path");

const detectProjectRoot = require("./detectProjectRoot").detectProjectRoot;
const { FirebaseError } = require("./error");
const fsutils = require("./fsutils");
const utils = require("./utils");

// "exclusive" target implies that a resource can only be assigned a single target name
const TARGET_TYPES = {
  storage: { resource: "bucket", exclusive: true },
  database: { resource: "instance", exclusive: true },
  hosting: { resource: "site", exclusive: true },
};

const RC = function(rcpath, data) {
  this.path = rcpath;
  this.data = data || {};
};

RC.prototype = {
  set: function(key, value) {
    return _.set(this.data, key, value);
  },

  unset: function(key) {
    return _.unset(this.data, key);
  },

  get: function(key, fallback) {
    return _.get(this.data, key, fallback);
  },

  addProjectAlias: function(alias, project) {
    this.set(["projects", alias], project);
    return this.save();
  },

  removeProjectAlias: function(alias) {
    this.unset(["projects", alias]);
    return this.save();
  },

  get hasProjects() {
    return _.size(this.data.projects) > 0;
  },

  get projects() {
    return this.get("projects", {});
  },

  targets: function(project, type) {
    return this.get(["targets", project, type], {});
  },

  target: function(project, type, name) {
    return this.get(["targets", project, type, name], []);
  },

  applyTarget: function(project, type, targetName, resources) {
    if (!TARGET_TYPES[type]) {
      throw new FirebaseError(
        "Unrecognized target type " +
          clc.bold(type) +
          ". Must be one of " +
          _.keys(TARGET_TYPES).join(", "),
        { code: 1 }
      );
    }

    if (_.isString(resources)) {
      resources = [resources];
    }

    const changed = [];

    // remove resources from existing targets
    resources.forEach(
      function(resource) {
        const cur = this.findTarget(project, type, resource);
        if (cur && cur !== targetName) {
          this.unsetTargetResource(project, type, cur, resource);
          changed.push({ resource: resource, target: cur });
        }
      }.bind(this)
    );

    // apply resources to new target
    const existing = this.get(["targets", project, type, targetName], []);
    const list = _.uniq(existing.concat(resources)).sort();
    this.set(["targets", project, type, targetName], list);

    this.save();
    return changed;
  },

  removeTarget: function(project, type, resource) {
    const name = this.findTarget(project, type, resource);
    if (!name) {
      return null;
    }

    this.unsetTargetResource(project, type, name, resource);
    this.save();
    return name;
  },

  clearTarget: function(project, type, name) {
    const exists = this.target(project, type, name).length > 0;
    if (!exists) {
      return false;
    }
    this.unset(["targets", project, type, name]);
    this.save();
    return true;
  },

  /**
   * Finds a target name for the specified type and resource.
   */
  findTarget: function(project, type, resource) {
    const targets = this.get(["targets", project, type]);
    for (const targetName in targets) {
      if (_.includes(targets[targetName], resource)) {
        return targetName;
      }
    }
    return null;
  },

  /**
   * Removes a specific resource from a specified target. Does
   * not persist the result.
   */
  unsetTargetResource: function(project, type, name, resource) {
    const targetPath = ["targets", project, type, name];
    const updatedResources = this.get(targetPath, []).filter(function(r) {
      return r !== resource;
    });

    if (updatedResources.length) {
      this.set(targetPath, updatedResources);
    } else {
      this.unset(targetPath);
    }
  },

  /**
   * Throws an error if the specified target is not configured for
   * the specified project.
   */
  requireTarget: function(project, type, name) {
    const target = this.target(project, type, name);
    if (!target.length) {
      throw new FirebaseError(
        "Deploy target " +
          clc.bold(name) +
          " not configured for project " +
          clc.bold(project) +
          ". Configure with:\n\n  firebase target:apply " +
          type +
          " " +
          name +
          " <resources...>",
        { exit: 1 }
      );
    }

    return target;
  },

  /**
   * Persists the RC file to disk, or returns false if no path on the instance.
   */
  save: function() {
    if (this.path) {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2), {
        encoding: "utf8",
      });
      return true;
    }
    return false;
  },
};

RC.loadFile = function(rcpath) {
  let data = {};
  if (fsutils.fileExistsSync(rcpath)) {
    try {
      data = cjson.load(rcpath);
    } catch (e) {
      // malformed rc file is a warning, not an error
      utils.logWarning("JSON error trying to load " + clc.bold(rcpath));
    }
  }
  return new RC(rcpath, data);
};

RC.load = function(cwd) {
  cwd = cwd || process.cwd();
  const dir = detectProjectRoot(cwd);
  const potential = path.resolve(dir || cwd, "./.firebaserc");
  return RC.loadFile(potential);
};

module.exports = RC;
