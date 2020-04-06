"use strict";

const repl = require("repl");
const _ = require("lodash");

const request = require("request");
const util = require("util");

const serveFunctions = require("./serve/functions");
const LocalFunction = require("./localFunction");
const logger = require("./logger");
const shell = require("./emulator/functionsEmulatorShell");
const commandUtitls = require("./emulator/commandUtils");

module.exports = function(options) {
  options.port = parseInt(options.port, 10);

  let debugPort = undefined;
  if (options.inspectFunctions) {
    debugPort = commandUtitls.parseInspectionPort(options);
  }

  return serveFunctions
    .start(options, {
      // TODO(samstern): Note that these are not acctually valid FunctionsEmulatorArgs
      // and when we eventually move to all TypeScript we'll have to start adding
      // projectId and functionsDir here.
      quiet: true,
      debugPort,
    })
    .then(function() {
      return serveFunctions.connect();
    })
    .then(function() {
      const instance = serveFunctions.get();
      const emulator = new shell.FunctionsEmulatorShell(instance);

      if (emulator.emulatedFunctions && emulator.emulatedFunctions.length === 0) {
        logger.info("No functions emulated.");
        process.exit();
      }

      const writer = function(output) {
        // Prevent full print out of Request object when a request is made
        if (output instanceof request.Request) {
          return "Sent request to function.";
        }
        return util.inspect(output);
      };

      const prompt = "firebase > ";

      const replServer = repl.start({
        prompt: prompt,
        writer: writer,
        useColors: true,
      });
      _.forEach(emulator.triggers, function(trigger) {
        if (_.includes(emulator.emulatedFunctions, trigger.name)) {
          const localFunction = new LocalFunction(trigger, emulator.urls, emulator);
          const triggerNameDotNotation = trigger.name.replace(/\-/g, ".");
          _.set(replServer.context, triggerNameDotNotation, localFunction.call);
        }
      });
      replServer.context.help =
        "Instructions for the Functions Shell can be found at: " +
        "https://firebase.google.com/docs/functions/local-emulator";
    })
    .then(function() {
      return new Promise(function(resolve) {
        process.on("SIGINT", function() {
          return serveFunctions
            .stop()
            .then(resolve)
            .catch(resolve);
        });
      });
    });
};
