"use strict";

const { Command } = require("../command");
const { requirePermissions } = require("../requirePermissions");
const action = require("../functionsShellCommandAction");
const requireConfig = require("../requireConfig");

module.exports = new Command("experimental:functions:shell")
  .description(
    "launch full Node shell with emulated functions. (Alias for `firebase functions:shell.)"
  )
  .option("-p, --port <port>", "the port on which to emulate functions (default: 5000)", 5000)
  .before(requireConfig)
  .before(requirePermissions)
  .action(action);
