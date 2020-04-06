"use strict";

const _ = require("lodash");
const archiver = require("archiver");
const clc = require("cli-color");
const filesize = require("filesize");
const fs = require("fs");
const path = require("path");
const tmp = require("tmp");

const { FirebaseError } = require("./error");
const functionsConfig = require("./functionsConfig");
const getProjectId = require("./getProjectId");
const logger = require("./logger");
const utils = require("./utils");
const parseTriggers = require("./parseTriggers");
const fsAsync = require("./fsAsync");
const { getRuntimeChoice } = require("./runtimeChoiceSelector");

const CONFIG_DEST_FILE = ".runtimeconfig.json";

const _getFunctionsConfig = function(context) {
  let next = Promise.resolve({});
  if (context.runtimeConfigEnabled) {
    next = functionsConfig.materializeAll(context.firebaseConfig.projectId).catch(function(err) {
      logger.debug(err);
      const errorCode = _.get(err, "context.response.statusCode");
      if (errorCode === 500 || errorCode === 503) {
        throw new FirebaseError(
          "Cloud Runtime Config is currently experiencing issues, " +
            "which is preventing your functions from being deployed. " +
            "Please wait a few minutes and then try to deploy your functions again." +
            "\nRun `firebase deploy --except functions` if you want to continue deploying the rest of your project."
        );
      }
    });
  }

  return next.then(function(config) {
    const firebaseConfig = _.get(context, "firebaseConfig");
    _.set(config, "firebase", firebaseConfig);
    return config;
  });
};

const _pipeAsync = function(from, to) {
  return new Promise(function(resolve, reject) {
    to.on("finish", resolve);
    to.on("error", reject);
    from.pipe(to);
  });
};

const _packageSource = function(options, sourceDir, configValues) {
  const tmpFile = tmp.fileSync({ prefix: "firebase-functions-", postfix: ".zip" }).name;
  const fileStream = fs.createWriteStream(tmpFile, {
    flags: "w",
    defaultEncoding: "binary",
  });
  const archive = archiver("zip");
  const archiveDone = _pipeAsync(archive, fileStream);

  // We must ignore firebase-debug.log or weird things happen if
  // you're in the public dir when you deploy.
  // We ignore any CONFIG_DEST_FILE that already exists, and write another one
  // with current config values into the archive in the "end" handler for reader
  const ignore = options.config.get("functions.ignore", ["node_modules"]);
  ignore.push("firebase-debug.log", CONFIG_DEST_FILE /* .runtimeconfig.json */);
  return fsAsync
    .readdirRecursive({ path: sourceDir, ignore: ignore })
    .then(function(files) {
      _.forEach(files, function(file) {
        archive.file(file.name, {
          name: path.relative(sourceDir, file.name),
          mode: file.mode,
        });
      });
      archive.append(JSON.stringify(configValues, null, 2), {
        name: CONFIG_DEST_FILE,
        mode: 420 /* 0o644 */,
      });
      archive.finalize();
      return archiveDone;
    })
    .then(
      function() {
        utils.logBullet(
          clc.cyan.bold("functions:") +
            " packaged " +
            clc.bold(options.config.get("functions.source")) +
            " (" +
            filesize(archive.pointer()) +
            ") for uploading"
        );
        return {
          file: tmpFile,
          stream: fs.createReadStream(tmpFile),
          size: archive.pointer(),
        };
      },
      function(err) {
        throw new FirebaseError(
          "Could not read source directory. Remove links and shortcuts and try again.",
          {
            original: err,
            exit: 1,
          }
        );
      }
    );
};

module.exports = function(context, options) {
  let configValues;
  const sourceDir = options.config.path(options.config.get("functions.source"));
  context.runtimeChoice = getRuntimeChoice(sourceDir);
  return _getFunctionsConfig(context)
    .then(function(result) {
      configValues = result;
      return parseTriggers(getProjectId(options), sourceDir, configValues);
    })
    .then(function(triggers) {
      options.config.set("functions.triggers", triggers);
      if (options.config.get("functions.triggers").length === 0) {
        return Promise.resolve(null);
      }
      return _packageSource(options, sourceDir, configValues);
    });
};
