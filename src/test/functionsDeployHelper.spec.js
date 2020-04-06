"use strict";

const chai = require("chai");
const expect = chai.expect;

const helper = require("../functionsDeployHelper");

describe("functionsDeployHelper", function() {
  describe("getFilterGroups", function() {
    it("should parse multiple filters", function() {
      const options = {
        only: "functions:myFunc,functions:myOtherFunc",
      };
      expect(helper.getFilterGroups(options)).to.deep.equal([["myFunc"], ["myOtherFunc"]]);
    });
    it("should parse nested filters", function() {
      const options = {
        only: "functions:groupA.myFunc",
      };
      expect(helper.getFilterGroups(options)).to.deep.equal([["groupA", "myFunc"]]);
    });
  });

  describe("getReleaseNames", function() {
    it("should handle function update", function() {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle function deletion", function() {
      const uploadNames = [];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle function creation", function() {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const existingNames = [];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle existing function not being in filter", function() {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc2"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle no functions satisfying filter", function() {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc2"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc3"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([]);
    });

    it("should handle entire function groups", function() {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myGroup-func1"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myGroup-func2"];
      const filter = [["myGroup"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myGroup-func1",
        "projects/myProject/locations/us-central1/functions/myGroup-func2",
      ]);
    });

    it("should handle functions within groups", function() {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myGroup-func1"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myGroup-func2"];
      const filter = [["myGroup", "func1"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myGroup-func1",
      ]);
    });
  });

  describe("getFunctionsInfo", function() {
    it("should handle default region", function() {
      const triggers = [
        {
          name: "myFunc",
        },
        {
          name: "myOtherFunc",
        },
      ];

      expect(helper.getFunctionsInfo(triggers, "myProject")).to.deep.equal([
        {
          name: "projects/myProject/locations/us-central1/functions/myFunc",
        },
        {
          name: "projects/myProject/locations/us-central1/functions/myOtherFunc",
        },
      ]);
    });

    it("should handle customized region", function() {
      const triggers = [
        {
          name: "myFunc",
          regions: ["us-east1"],
        },
        {
          name: "myOtherFunc",
        },
      ];

      expect(helper.getFunctionsInfo(triggers, "myProject")).to.deep.equal([
        {
          name: "projects/myProject/locations/us-east1/functions/myFunc",
        },
        {
          name: "projects/myProject/locations/us-central1/functions/myOtherFunc",
        },
      ]);
    });

    it("should handle multiple customized region for a function", function() {
      const triggers = [
        {
          name: "myFunc",
          regions: ["us-east1", "eu-west1"],
        },
      ];

      expect(helper.getFunctionsInfo(triggers, "myProject")).to.deep.equal([
        {
          name: "projects/myProject/locations/us-east1/functions/myFunc",
        },
        {
          name: "projects/myProject/locations/eu-west1/functions/myFunc",
        },
      ]);
    });
  });
});
