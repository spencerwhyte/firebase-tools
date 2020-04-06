"use strict";

const chai = require("chai");

const path = require("path");
const stream = require("stream");
const ProfileReport = require("../profileReport");

const expect = chai.expect;

const combinerFunc = function(obj1, obj2) {
  return { count: obj1.count + obj2.count };
};

const fixturesDir = path.resolve(__dirname, "./fixtures");

const newReport = function() {
  const input = path.resolve(fixturesDir, "profiler-data/sample.json");
  const throwAwayStream = new stream.PassThrough();
  return new ProfileReport(input, throwAwayStream, {
    format: "JSON",
    isFile: false,
    collapse: true,
    isInput: true,
  });
};

describe("profilerReport", function() {
  it("should correctly generate a report", function() {
    const report = newReport();
    const output = require(path.resolve(fixturesDir, "profiler-data/sample-output.json"));
    return expect(report.generate()).to.eventually.deep.equal(output);
  });

  it("should format numbers correctly", function() {
    let result = ProfileReport.formatNumber(5);
    expect(result).to.eq("5");
    result = ProfileReport.formatNumber(5.0);
    expect(result).to.eq("5");
    result = ProfileReport.formatNumber(3.33);
    expect(result).to.eq("3.33");
    result = ProfileReport.formatNumber(3.123423);
    expect(result).to.eq("3.12");
    result = ProfileReport.formatNumber(3.129);
    expect(result).to.eq("3.13");
    result = ProfileReport.formatNumber(3123423232);
    expect(result).to.eq("3,123,423,232");
    result = ProfileReport.formatNumber(3123423232.4242);
    expect(result).to.eq("3,123,423,232.42");
  });

  it("should not collapse paths if not needed", function() {
    const report = newReport();
    const data = {};
    for (let i = 0; i < 20; i++) {
      data["/path/num" + i] = { count: 1 };
    }
    const result = report.collapsePaths(data, combinerFunc);
    expect(result).to.deep.eq(data);
  });

  it("should collapse paths to $wildcard", function() {
    const report = newReport();
    const data = {};
    for (let i = 0; i < 30; i++) {
      data["/path/num" + i] = { count: 1 };
    }
    const result = report.collapsePaths(data, combinerFunc);
    expect(result).to.deep.eq({ "/path/$wildcard": { count: 30 } });
  });

  it("should not collapse paths with --no-collapse", function() {
    const report = newReport();
    report.options.collapse = false;
    const data = {};
    for (let i = 0; i < 30; i++) {
      data["/path/num" + i] = { count: 1 };
    }
    const result = report.collapsePaths(data, combinerFunc);
    expect(result).to.deep.eq(data);
  });

  it("should collapse paths recursively", function() {
    const report = newReport();
    const data = {};
    for (let i = 0; i < 30; i++) {
      data["/path/num" + i + "/next" + i] = { count: 1 };
    }
    data["/path/num1/bar/test"] = { count: 1 };
    data["/foo"] = { count: 1 };
    const result = report.collapsePaths(data, combinerFunc);
    expect(result).to.deep.eq({
      "/path/$wildcard/$wildcard": { count: 30 },
      "/path/$wildcard/$wildcard/test": { count: 1 },
      "/foo": { count: 1 },
    });
  });

  it("should extract the correct path index", function() {
    const query = { index: { path: ["foo", "bar"] } };
    const result = ProfileReport.extractReadableIndex(query);
    expect(result).to.eq("/foo/bar");
  });

  it("should extract the correct value index", function() {
    const query = { index: {} };
    const result = ProfileReport.extractReadableIndex(query);
    expect(result).to.eq(".value");
  });
});
