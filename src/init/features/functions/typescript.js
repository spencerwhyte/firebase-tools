"use strict";

const _ = require("lodash");
const fs = require("fs");
const path = require("path");

const npmDependencies = require("./npm-dependencies");
const { prompt } = require("../../../prompt");

const TEMPLATE_ROOT = path.resolve(__dirname, "../../../../templates/init/functions/typescript/");
const PACKAGE_LINTING_TEMPLATE = fs.readFileSync(
  path.join(TEMPLATE_ROOT, "package.lint.json"),
  "utf8"
);
const PACKAGE_NO_LINTING_TEMPLATE = fs.readFileSync(
  path.join(TEMPLATE_ROOT, "package.nolint.json"),
  "utf8"
);
const TSLINT_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_ROOT, "tslint.json"), "utf8");
const TSCONFIG_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_ROOT, "tsconfig.json"), "utf8");
const INDEX_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_ROOT, "index.ts"), "utf8");
const GITIGNORE_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_ROOT, "_gitignore"), "utf8");

module.exports = function(setup, config) {
  return prompt(setup.functions, [
    {
      name: "lint",
      type: "confirm",
      message: "Do you want to use TSLint to catch probable bugs and enforce style?",
      default: true,
    },
  ])
    .then(function() {
      if (setup.functions.lint) {
        _.set(setup, "config.functions.predeploy", [
          'npm --prefix "$RESOURCE_DIR" run lint',
          'npm --prefix "$RESOURCE_DIR" run build',
        ]);
        return config
          .askWriteProjectFile("functions/package.json", PACKAGE_LINTING_TEMPLATE)
          .then(function() {
            return config.askWriteProjectFile("functions/tslint.json", TSLINT_TEMPLATE);
          });
      }
      _.set(setup, "config.functions.predeploy", 'npm --prefix "$RESOURCE_DIR" run build');
      return config.askWriteProjectFile("functions/package.json", PACKAGE_NO_LINTING_TEMPLATE);
    })
    .then(function() {
      return config.askWriteProjectFile("functions/tsconfig.json", TSCONFIG_TEMPLATE);
    })
    .then(function() {
      return config.askWriteProjectFile("functions/src/index.ts", INDEX_TEMPLATE);
    })
    .then(function() {
      return config.askWriteProjectFile("functions/.gitignore", GITIGNORE_TEMPLATE);
    })
    .then(function() {
      return npmDependencies.askInstallDependencies(setup.functions, config);
    });
};
