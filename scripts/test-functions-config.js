#!/usr/bin/env node
"use strict";

/**
 * Integration test for functions config commands. Run:
 * node ./test-functions-config.js <projectId>
 *
 * If parameter ommited:
 * - projectId defaults to `functions-integration-test`
 */

const clc = require("cli-color");
const exec = require("child_process").exec;
const execSync = require("child_process").execSync;
const expect = require("chai").expect;
const fs = require("fs-extra");
const tmp = require("tmp");

const api = require("../lib/api");
const scopes = require("../lib/scopes");
const { configstore } = require("../lib/configstore");

const projectId = process.argv[2] || "functions-integration-test";
const localFirebase = __dirname + "/../lib/bin/firebase.js";
const projectDir = __dirname + "/test-project";
let tmpDir;

const preTest = function() {
  const dir = tmp.dirSync({ prefix: "cfgtest_" });
  tmpDir = dir.name;
  fs.copySync(projectDir, tmpDir);
  api.setRefreshToken(configstore.get("tokens").refresh_token);
  api.setScopes(scopes.CLOUD_PLATFORM);
  execSync(`${localFirebase} functions:config:unset foo --project=${projectId}`, { cwd: tmpDir });
  console.log("Done pretest prep.");
};

const postTest = function() {
  fs.remove(tmpDir);
  console.log("Done post-test cleanup.");
};

const set = function(expression) {
  return new Promise(function(resolve) {
    exec(
      `${localFirebase} functions:config:set ${expression} --project=${projectId}`,
      { cwd: tmpDir },
      function(err) {
        expect(err).to.be.null;
        resolve();
      }
    );
  });
};

const unset = function(key) {
  return new Promise(function(resolve) {
    exec(
      `${localFirebase} functions:config:unset ${key} --project=${projectId}`,
      { cwd: tmpDir },
      function(err) {
        expect(err).to.be.null;
        resolve();
      }
    );
  });
};

const getAndCompare = function(expected) {
  return new Promise(function(resolve) {
    exec(`${localFirebase} functions:config:get --project=${projectId}`, { cwd: tmpDir }, function(
      err,
      stdout
    ) {
      expect(JSON.parse(stdout)).to.deep.equal(expected);
      resolve();
    });
  });
};

const runTest = function(description, expression, key, expected) {
  return set(expression)
    .then(function() {
      return getAndCompare(expected);
    })
    .then(function() {
      return unset(key);
    })
    .then(function() {
      console.log(clc.green("\u2713 Test passed: ") + description);
    });
};

const main = function() {
  preTest();
  runTest("string value", "foo.bar=faz", "foo", { foo: { bar: "faz" } })
    .then(function() {
      return runTest("string value in quotes", 'foo.bar="faz"', "foo", {
        foo: { bar: "faz" },
      });
    })
    .then(function() {
      return runTest("string value with quotes", "foo.bar='\"faz\"'", "foo", {
        foo: { bar: '"faz"' },
      });
    })
    .then(function() {
      return runTest("single-part key and JSON value", 'foo=\'{"bar":"faz"}\'', "foo", {
        foo: { bar: "faz" },
      });
    })
    .then(function() {
      return runTest("multi-part key and JSON value", 'foo.too=\'{"bar":"faz"}\'', "foo", {
        foo: { too: { bar: "faz" } },
      });
    })
    .then(function() {
      return runTest("numeric value", "foo.bar=123", "foo", {
        foo: { bar: "123" },
      });
    })
    .then(function() {
      return runTest("numeric value in quotes", 'foo.bar="123"', "foo", {
        foo: { bar: "123" },
      });
    })
    .then(function() {
      return runTest("null value", "foo.bar=null", "foo", {
        foo: { bar: "null" },
      });
    })
    .catch(function(err) {
      console.log(clc.red("Error while running tests: "), err);
      return Promise.resolve();
    })
    .then(postTest);
};

main();
