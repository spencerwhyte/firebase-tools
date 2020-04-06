"use strict";

const JSONSchema = require("jsonschema");
const jsonschema = new JSONSchema.Validator();
const request = require("request");

const { FirebaseError } = require("./error");

const NAMED_SCHEMAS = {
  firebase:
    "https://gist.githubusercontent.com/mbleigh/6040df46f12f349889b2/raw/1c11a6e00a7295c84508dca80f2c92b00ba44006/firebase-schema.json",
};

const Validator = function(url) {
  this._validateQueue = [];

  const self = this;
  request.get(url, function(err, response, body) {
    if (!err && response.statusCode === 200) {
      self.schema = JSON.parse(body);
      self._process();
    }
  });
};

Validator.prototype.validate = function(data) {
  const self = this;
  return new Promise(function(resolve, reject) {
    self._validateQueue.push({
      data: data,
      resolve: resolve,
      reject: reject,
    });
    self._process();
  });
};

Validator.prototype._process = function() {
  if (!this.schema) {
    return;
  }
  while (this._validateQueue.length) {
    const item = this._validateQueue.shift();
    const result = jsonschema.validate(item.data, this.schema);

    const err = new FirebaseError("Your document has validation errors", {
      children: this._decorateErrors(result.errors),
      exit: 2,
    });

    if (result.valid) {
      item.resolve();
    } else {
      item.reject(err);
    }
  }
};

Validator.prototype._decorateErrors = function(errors) {
  errors.forEach(function(error) {
    error.name = error.property.replace(/^instance/, "root");
  });
  return errors;
};

for (const name in NAMED_SCHEMAS) {
  if ({}.hasOwnProperty.call(NAMED_SCHEMAS, name)) {
    Validator[name] = new Validator(NAMED_SCHEMAS[name]);
  }
}

module.exports = Validator;
