"use strict";

const chai = require("chai");
const expect = chai.expect;

const Config = require("../config");
const path = require("path");

const _fixtureDir = function(name) {
  return path.resolve(__dirname, "./fixtures/" + name);
};

describe("Config", function() {
  describe("#_parseFile", function() {
    it("should load a cjson file", function() {
      const config = new Config({}, { cwd: _fixtureDir("config-imports") });
      expect(config._parseFile("hosting", "hosting.json").public).to.equal(".");
    });

    it("should error out for an unknown file", function() {
      const config = new Config({}, { cwd: _fixtureDir("config-imports") });
      expect(function() {
        config._parseFile("hosting", "i-dont-exist.json");
      }).to.throw("Imported file i-dont-exist.json does not exist");
    });

    it("should error out for an unrecognized extension", function() {
      const config = new Config({}, { cwd: _fixtureDir("config-imports") });
      expect(function() {
        config._parseFile("hosting", "unsupported.txt");
      }).to.throw("unsupported.txt is not of a supported config file type");
    });
  });

  describe("#_materialize", function() {
    it("should assign unaltered if an object is found", function() {
      const config = new Config({ example: { foo: "bar" } }, {});
      expect(config._materialize("example").foo).to.equal("bar");
    });

    it("should prevent top-level key duplication", function() {
      const config = new Config({ rules: "rules.json" }, { cwd: _fixtureDir("dup-top-level") });
      expect(config._materialize("rules")).to.deep.equal({ ".read": true });
    });
  });
});
