"use strict";

const api = require("../api");

const version = "v2beta1";

const _listEntries = function(projectId, filter, pageSize, order) {
  return api
    .request("POST", "/" + version + "/entries:list", {
      auth: true,
      data: {
        projectIds: [projectId],
        filter: filter,
        orderBy: "timestamp " + order,
        pageSize: pageSize,
      },
      origin: api.cloudloggingOrigin,
    })
    .then(function(result) {
      return Promise.resolve(result.body.entries);
    });
};

module.exports = {
  listEntries: _listEntries,
};
