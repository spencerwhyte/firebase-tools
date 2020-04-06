#!/usr/bin/env node
"use strict";

/**
 * Integration test for testing function deploys. Run:
 * node ./test-functions-deploy.js <projectId> <region>
 *
 * If parameters ommited:
 * - projectId defaults to `functions-integration-test`
 * - region defaults to `us-central1`
 */

const expect = require("chai").expect;
const execSync = require("child_process").execSync;
const exec = require("child_process").exec;
const tmp = require("tmp");
const _ = require("lodash");
const fs = require("fs-extra");
const cloudfunctions = require("../lib/gcp/cloudfunctions");
const api = require("../lib/api");
const scopes = require("../lib/scopes");
const { configstore } = require("../lib/configstore");
const extractTriggers = require("../lib/extractTriggers");
const functionsConfig = require("../lib/functionsConfig");

const clc = require("cli-color");
const firebase = require("firebase");

const functionsSource = __dirname + "/assets/functions_to_test.js";
const projectDir = __dirname + "/test-project";
const projectId = process.argv[2] || "functions-integration-test";
const region = process.argv[3] || "us-central1";
const httpsTrigger = `https://${region}-${projectId}.cloudfunctions.net/httpsAction`;
const localFirebase = __dirname + "/../lib/bin/firebase.js";
const TIMEOUT = 40000;
let tmpDir;
let app;

const deleteAllFunctions = function() {
  const toDelete = _.map(parseFunctionsList(), function(funcName) {
    return funcName.replace("-", ".");
  });
  return localFirebase + ` functions:delete ${toDelete.join(" ")} -f --project=${projectId}`;
};

var parseFunctionsList = function() {
  const triggers = [];
  extractTriggers(require(functionsSource), triggers);
  return _.map(triggers, "name");
};

const getUuid = function() {
  return Math.floor(Math.random() * 100000000000).toString();
};

const preTest = async function() {
  const dir = tmp.dirSync({ prefix: "fntest_" });
  tmpDir = dir.name;
  fs.copySync(projectDir, tmpDir);
  execSync("npm install", { cwd: tmpDir + "/functions", stdio: "ignore", stderr: "ignore" });
  api.setRefreshToken(configstore.get("tokens").refresh_token);
  api.setScopes(scopes.CLOUD_PLATFORM);
  const accessToken = (await api.getAccessToken()).access_token;
  api.setAccessToken(accessToken);

  return functionsConfig.getFirebaseConfig({ project: projectId }).then(function(config) {
    process.env.GCLOUD_PROJECT = projectId;
    process.env.FIREBASE_CONFIG = JSON.stringify(config);
    app = firebase.initializeApp(config);
    try {
      execSync(deleteAllFunctions(), { cwd: tmpDir, stdio: "ignore" });
    } catch (e) {
      // do nothing
    }
  });
};

const postTest = function(errored) {
  fs.remove(tmpDir);
  delete process.env.GCLOUD_PROJECT;
  delete process.env.FIREBASE_CONFIG;
  // If tests were successful, clean up functions and database. Otherwise, leave them for debugging purposes.
  if (!errored) {
    try {
      execSync(deleteAllFunctions(), { cwd: tmpDir, stdio: "ignore" });
    } catch (e) {
      // do nothing
    }
    execSync(`${localFirebase} database:remove / -y --project=${projectId}`, { cwd: tmpDir });
  }
  console.log("Done post-test cleanup.");
  process.exit();
};

const checkFunctionsListMatch = function(expectedFunctions) {
  let deployedFunctions;
  return cloudfunctions
    .list(projectId, region)
    .then(function(result) {
      deployedFunctions = _.map(result, "functionName");
      expect(_.isEmpty(_.xor(expectedFunctions, deployedFunctions))).to.be.true;
      return true;
    })
    .catch(function(err) {
      console.log(clc.red("Deployed functions do not match expected functions"));
      console.log("Expected functions are: ", expectedFunctions);
      console.log("Deployed functions are: ", deployedFunctions);
      return Promise.reject(err);
    });
};

const testCreateUpdate = function() {
  fs.copySync(functionsSource, tmpDir + "/functions/index.js");
  return new Promise(function(resolve) {
    exec(`${localFirebase} deploy --project=${projectId}`, { cwd: tmpDir }, function(err, stdout) {
      console.log(stdout);
      expect(err).to.be.null;
      resolve(checkFunctionsListMatch(parseFunctionsList()));
    });
  });
};

const testCreateUpdateWithFilter = function() {
  fs.copySync(functionsSource, tmpDir + "/functions/index.js");
  return new Promise(function(resolve) {
    exec(
      `${localFirebase} deploy --only functions:nested,functions:httpsAction --project=${projectId}`,
      { cwd: tmpDir },
      function(err, stdout) {
        console.log(stdout);
        expect(err).to.be.null;
        resolve(checkFunctionsListMatch(["nested-dbAction", "httpsAction"]));
      }
    );
  });
};

const testDelete = function() {
  return new Promise(function(resolve) {
    exec(deleteAllFunctions(), { cwd: tmpDir }, function(err, stdout) {
      console.log(stdout);
      expect(err).to.be.null;
      resolve(checkFunctionsListMatch([]));
    });
  });
};

const testDeleteWithFilter = function() {
  return new Promise(function(resolve) {
    exec(
      `${localFirebase} functions:delete nested -f --project=${projectId}`,
      { cwd: tmpDir },
      function(err, stdout) {
        console.log(stdout);
        expect(err).to.be.null;
        resolve(checkFunctionsListMatch(["httpsAction"]));
      }
    );
  });
};

const testUnknownFilter = function() {
  return new Promise(function(resolve) {
    exec(
      "> functions/index.js &&" +
        `${localFirebase} deploy --only functions:unknownFilter --project=${projectId}`,
      { cwd: tmpDir },
      function(err, stdout) {
        console.log(stdout);
        expect(stdout).to.contain(
          "the following filters were specified but do not match any functions in the project: unknownFilter"
        );
        expect(err).to.be.null;
        resolve();
      }
    );
  });
};

const waitForAck = function(uuid, testDescription) {
  return Promise.race([
    new Promise(function(resolve) {
      const ref = firebase
        .database()
        .ref("output")
        .child(uuid);
      var listener = ref.on("value", function(snap) {
        if (snap.exists()) {
          ref.off("value", listener);
          resolve();
        }
      });
    }),
    new Promise(function(resolve, reject) {
      setTimeout(function() {
        reject("Timed out while waiting for output from " + testDescription);
      }, TIMEOUT);
    }),
  ]);
};

const writeToDB = function(path) {
  const uuid = getUuid();
  return app
    .database()
    .ref(path)
    .child(uuid)
    .set({ foo: "bar" })
    .then(function() {
      return Promise.resolve(uuid);
    });
};

const sendHttpRequest = function(message) {
  return api
    .request("POST", httpsTrigger, {
      data: message,
      origin: "",
    })
    .then(function(resp) {
      expect(resp.status).to.equal(200);
      expect(resp.body).to.deep.equal(message);
    });
};

const publishPubsub = function(topic) {
  const uuid = getUuid();
  const message = new Buffer(uuid).toString("base64");
  return api
    .request("POST", `/v1/projects/${projectId}/topics/${topic}:publish`, {
      auth: true,
      data: {
        messages: [{ data: message }],
      },
      origin: "https://pubsub.googleapis.com",
    })
    .then(function(resp) {
      expect(resp.status).to.equal(200);
      return Promise.resolve(uuid);
    });
};

const triggerSchedule = function(job) {
  // we can't pass along a uuid thru scheduler to test the full trigger,
  // so instead we run the job to make sure that the scheduler job and pub sub topic were created correctly
  return api
    .request("POST", `/v1/projects/${projectId}/locations/us-central1/jobs/${job}:run`, {
      auth: true,
      data: {},
      origin: "https://cloudscheduler.googleapis.com",
    })
    .then(function(resp) {
      expect(resp.status).to.equal(200);
      return Promise.resolve();
    });
};

const saveToStorage = function() {
  const uuid = getUuid();
  const contentLength = Buffer.byteLength(uuid, "utf8");
  const resource = ["b", projectId + ".appspot.com", "o"].join("/");
  const endpoint = "/upload/storage/v1/" + resource + "?uploadType=media&name=" + uuid;
  return api
    .request("POST", endpoint, {
      auth: true,
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": contentLength,
      },
      data: uuid,
      json: false,
      origin: api.googleOrigin,
    })
    .then(function(resp) {
      expect(resp.status).to.equal(200);
      return Promise.resolve(uuid);
    });
};

const testFunctionsTrigger = function() {
  const checkDbAction = writeToDB("input").then(function(uuid) {
    return waitForAck(uuid, "database triggered function");
  });
  const checkNestedDbAction = writeToDB("inputNested").then(function(uuid) {
    return waitForAck(uuid, "nested database triggered function");
  });
  const checkHttpsAction = sendHttpRequest({ message: "hello" });
  const checkPubsubAction = publishPubsub("topic1").then(function(uuid) {
    return waitForAck(uuid, "pubsub triggered function");
  });
  const checkGcsAction = saveToStorage().then(function(uuid) {
    return waitForAck(uuid, "storage triggered function");
  });
  const checkScheduleAction = triggerSchedule(
    "firebase-schedule-pubsubScheduleAction-us-central1"
  ).then(function(/* uuid */) {
    return true;
  });
  return Promise.all([
    checkDbAction,
    checkNestedDbAction,
    checkHttpsAction,
    checkPubsubAction,
    checkGcsAction,
    checkScheduleAction,
  ]);
};

const main = function() {
  preTest()
    .then(function() {
      console.log("Done pretest prep.");
      return testCreateUpdate();
    })
    .then(function() {
      console.log(clc.green("\u2713 Test passed: creating functions"));
      return testCreateUpdate();
    })
    .then(function() {
      console.log(clc.green("\u2713 Test passed: updating functions"));
      return testFunctionsTrigger();
    })
    .then(function() {
      console.log(clc.green("\u2713 Test passed: triggering functions"));
      return testDelete();
    })
    .then(function() {
      console.log(clc.green("\u2713 Test passed: deleting functions"));
      return testCreateUpdateWithFilter();
    })
    .then(function() {
      console.log(clc.green("\u2713 Test passed: creating functions with filters"));
      return testDeleteWithFilter();
    })
    .then(function() {
      console.log(clc.green("\u2713 Test passed: deleting functions with filters"));
      return testUnknownFilter();
    })
    .then(function() {
      console.log(
        clc.green("\u2713 Test passed: threw warning when passing filter with unknown identifier")
      );
    })
    .catch(function(err) {
      console.log(clc.red("Error while running tests: "), err);
      return Promise.resolve(err);
    })
    .then(function(err) {
      postTest(!!err);
    });
};

main();
