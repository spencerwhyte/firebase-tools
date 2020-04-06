"use strict";

const { Command } = require("../command");

const clc = require("cli-color");
const logger = require("../logger");
const utils = require("../utils");

module.exports = new Command("help [command]")
  .description("display help information")
  .action(function(commandName) {
    const cmd = this.client.getCommand(commandName);
    if (cmd) {
      cmd.outputHelp();
    } else if (commandName) {
      logger.warn();
      utils.logWarning(
        clc.bold(commandName) + " is not a valid command. See below for valid commands"
      );
      this.client.cli.outputHelp();
    } else {
      this.client.cli.outputHelp();
      logger.info();
      logger.info(
        "  To get help with a specific command, type",
        clc.bold("firebase help [command_name]")
      );
      logger.info();
    }

    return Promise.resolve();
  });
