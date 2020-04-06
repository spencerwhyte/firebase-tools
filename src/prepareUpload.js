"use strict";

const fs = require("fs");
const path = require("path");

const tar = require("tar");
const tmp = require("tmp");

const { listFiles } = require("./listFiles");
const { FirebaseError } = require("./error");
const fsutils = require("./fsutils");

module.exports = function(options) {
  const hostingConfig = options.config.get("hosting");
  const publicDir = options.config.path(hostingConfig.public);
  const indexPath = path.join(publicDir, "index.html");

  const tmpFile = tmp.fileSync({
    prefix: "firebase-upload-",
    postfix: ".tar.gz",
  });
  const manifest = listFiles(publicDir, hostingConfig.ignore);

  return tar
    .c(
      {
        gzip: true,
        file: tmpFile.name,
        cwd: publicDir,
        prefix: "public",
        follow: true,
        noDirRecurse: true,
        portable: true,
      },
      manifest.slice(0)
    )
    .then(function() {
      const stats = fs.statSync(tmpFile.name);
      return {
        file: tmpFile.name,
        stream: fs.createReadStream(tmpFile.name),
        manifest: manifest,
        foundIndex: fsutils.fileExistsSync(indexPath),
        size: stats.size,
      };
    })
    .catch(function(err) {
      return Promise.reject(
        new FirebaseError("There was an issue preparing Hosting files for upload.", {
          original: err,
          exit: 2,
        })
      );
    });
};
