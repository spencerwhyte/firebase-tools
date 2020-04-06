"use strict";

const clc = require("cli-color");
const fs = require("fs");
const os = require("os");

const { Command } = require("../command");
const accountExporter = require("../accountExporter");
const getProjectId = require("../getProjectId");
const logger = require("../logger");
const { requirePermissions } = require("../requirePermissions");

const MAX_BATCH_SIZE = 1000;

const validateOptions = accountExporter.validateOptions;
const serialExportUsers = accountExporter.serialExportUsers;

module.exports = new Command("auth:export [dataFile]")
  .description("Export accounts from your Firebase project into a data file")
  .option(
    "--format <format>",
    "Format of exported data (csv, json). Ignored if [dataFile] has format extension."
  )
  .before(requirePermissions, ["firebaseauth.users.get"])
  .action(function(dataFile, options) {
    const projectId = getProjectId(options);
    const checkRes = validateOptions(options, dataFile);
    if (!checkRes.format) {
      return checkRes;
    }
    const exportOptions = checkRes;
    const writeStream = fs.createWriteStream(dataFile);
    if (exportOptions.format === "json") {
      writeStream.write('{"users": [' + os.EOL);
    }
    exportOptions.writeStream = writeStream;
    exportOptions.batchSize = MAX_BATCH_SIZE;
    logger.info("Exporting accounts to " + clc.bold(dataFile));
    return serialExportUsers(projectId, exportOptions).then(function() {
      if (exportOptions.format === "json") {
        writeStream.write("]}");
      }
      writeStream.end();
      // Ensure process ends only when all data have been flushed
      // to the output file
      return new Promise(function(resolve, reject) {
        writeStream.on("finish", resolve);
        writeStream.on("close", resolve);
        writeStream.on("error", reject);
      });
    });
  });
