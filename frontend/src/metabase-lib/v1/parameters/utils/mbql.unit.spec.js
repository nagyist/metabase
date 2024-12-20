import moment from "moment-timezone"; // eslint-disable-line no-restricted-imports -- deprecated usage

import * as Lib from "metabase-lib";
import { createQuery } from "metabase-lib/test-helpers";
import {
  applyFilterParameter,
  dateParameterValueToMBQL,
  numberParameterValueToMBQL,
  stringParameterValueToMBQL,
} from "metabase-lib/v1/parameters/utils/mbql";
import { PRODUCTS, PRODUCTS_ID } from "metabase-types/api/mocks/presets";

describe("parameters/utils/mbql", () => {
  describe("dateParameterValueToMBQL", () => {
    const date = () =>
      moment().utc().hours(0).minutes(0).seconds(0).milliseconds(0);

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(date().date(1).month(1).toDate());
    });

    it("should parse past30days", () => {
      expect(dateParameterValueToMBQL("past30days", null)).toEqual([
        "time-interval",
        null,
        -30,
        "day",
      ]);
    });

    it("should parse past30days~", () => {
      expect(dateParameterValueToMBQL("past30days~", null)).toEqual([
        "time-interval",
        null,
        -30,
        "day",
        { "include-current": true },
      ]);
    });

    it("should parse past30days-from-3years", () => {
      expect(dateParameterValueToMBQL("past30days-from-3years", null)).toEqual([
        "between",
        ["+", null, ["interval", 3, "year"]],
        ["relative-datetime", -30, "day"],
        ["relative-datetime", 0, "day"],
      ]);
    });

    it("should parse next2years", () => {
      expect(dateParameterValueToMBQL("next2years", null)).toEqual([
        "time-interval",
        null,
        2,
        "year",
      ]);
    });

    it("should parse next2years~", () => {
      expect(dateParameterValueToMBQL("next2years~", null)).toEqual([
        "time-interval",
        null,
        2,
        "year",
        { "include-current": true },
      ]);
    });

    it("should parse next2years-from-3months", () => {
      expect(dateParameterValueToMBQL("next2years-from-3months", null)).toEqual(
        [
          "between",
          ["+", null, ["interval", -3, "month"]],
          ["relative-datetime", 0, "year"],
          ["relative-datetime", 2, "year"],
        ],
      );
    });

    it("should parse thisday", () => {
      expect(dateParameterValueToMBQL("thisday", null)).toEqual([
        "time-interval",
        null,
        "current",
        "day",
      ]);
    });

    it("should parse ~2017-05-01", () => {
      expect(dateParameterValueToMBQL("~2017-05-01", null)).toEqual([
        "<",
        null,
        "2017-05-01",
      ]);
    });

    it("should parse 2017-05-01~", () => {
      expect(dateParameterValueToMBQL("2017-05-01~", null)).toEqual([
        ">",
        null,
        "2017-05-01",
      ]);
    });

    it("should parse 2017-05", () => {
      expect(dateParameterValueToMBQL("2017-05", null)).toEqual([
        "=",
        ["field", null, { "temporal-unit": "month" }],
        "2017-05-01",
      ]);
    });

    it("should parse Q1-2017", () => {
      expect(dateParameterValueToMBQL("Q1-2017", null)).toEqual([
        "=",
        ["field", null, { "temporal-unit": "quarter" }],
        "2017-01-01",
      ]);
    });

    it("should parse 2017-05-01", () => {
      expect(dateParameterValueToMBQL("2017-05-01", null)).toEqual([
        "=",
        null,
        "2017-05-01",
      ]);
    });

    it("should parse 2017-05-01~2017-05-02", () => {
      expect(dateParameterValueToMBQL("2017-05-01~2017-05-02", null)).toEqual([
        "between",
        null,
        "2017-05-01",
        "2017-05-02",
      ]);
    });

    it("should parse exclude-hours-0", () => {
      expect(dateParameterValueToMBQL("exclude-hours-0", null)).toEqual([
        "!=",
        ["field", null, { "temporal-unit": "hour-of-day" }],
        0,
      ]);
    });

    it("should parse exclude-hours-0-23", () => {
      expect(dateParameterValueToMBQL("exclude-hours-0-23", null)).toEqual([
        "!=",
        ["field", null, { "temporal-unit": "hour-of-day" }],
        0,
        23,
      ]);
    });

    it("should parse exclude-quarters-1", () => {
      expect(dateParameterValueToMBQL("exclude-quarters-1", null)).toEqual([
        "!=",
        ["field", null, { "temporal-unit": "quarter-of-year" }],
        date().quarter(1).format("YYYY-MM-DD"),
      ]);
    });

    it("should parse exclude-quarters-1-2", () => {
      expect(dateParameterValueToMBQL("exclude-quarters-1-2", null)).toEqual([
        "!=",
        ["field", null, { "temporal-unit": "quarter-of-year" }],
        date().quarter(1).format("YYYY-MM-DD"),
        date().quarter(2).format("YYYY-MM-DD"),
      ]);
    });

    it("should parse exclude-months-Feb-Mar", () => {
      expect(dateParameterValueToMBQL("exclude-months-Feb-Mar", null)).toEqual([
        "!=",
        ["field", null, { "temporal-unit": "month-of-year" }],
        date().date(1).month(1).format("YYYY-MM-DD"),
        date().date(1).month(2).format("YYYY-MM-DD"),
      ]);
    });

    it("should parse exclude-days-Mon-Fri", () => {
      expect(dateParameterValueToMBQL("exclude-days-Mon-Fri", null)).toEqual([
        "!=",
        ["field", null, { "temporal-unit": "day-of-week" }],
        date().day(1).format("YYYY-MM-DD"),
        date().day(5).format("YYYY-MM-DD"),
      ]);
    });
  });

  describe("stringParameterValueToMBQL", () => {
    describe("when given an array parameter value", () => {
      it("should flatten the array parameter values", () => {
        expect(
          stringParameterValueToMBQL(
            { type: "number/=", value: ["1", "2"] },
            null,
          ),
        ).toEqual(["=", null, "1", "2"]);
      });
    });

    describe("when given a string parameter value", () => {
      it("should return the correct MBQL", () => {
        expect(
          stringParameterValueToMBQL(
            { type: "string/starts-with", value: "1" },
            null,
          ),
        ).toEqual([
          "starts-with",
          null,
          "1",
          {
            "case-sensitive": false,
          },
        ]);
      });
    });

    it("should default the operator to `=`", () => {
      expect(
        stringParameterValueToMBQL(
          { type: "category", value: ["1", "2"] },
          null,
        ),
      ).toEqual(["=", null, "1", "2"]);

      expect(
        stringParameterValueToMBQL(
          { type: "location/city", value: ["1", "2"] },
          null,
        ),
      ).toEqual(["=", null, "1", "2"]);
    });
  });

  describe("numberParameterValueToMBQL", () => {
    describe("when given an array parameter value", () => {
      it("should flatten the array parameter values", () => {
        expect(
          numberParameterValueToMBQL(
            { type: "number/between", value: [1, 2] },
            null,
          ),
        ).toEqual(["between", null, 1, 2]);
      });
    });

    describe("when given a string parameter value", () => {
      it("should parse the parameter value as a float", () => {
        expect(
          numberParameterValueToMBQL({ type: "number/=", value: "1.1" }, null),
        ).toEqual(["=", null, 1.1]);
      });
    });
  });

  describe("fieldFilterParameterToFilter", () => {
    const query = Lib.withDifferentTable(createQuery(), PRODUCTS_ID);
    const stageIndex = -1;

    it("should not modify the query for parameter targets that are not field dimension targets", () => {
      expect(
        applyFilterParameter(query, stageIndex, {
          target: null,
          type: "category",
          value: ["foo"],
        }),
      ).toBe(query);

      expect(
        applyFilterParameter(query, stageIndex, {
          target: [],
          type: "category",
          value: ["foo"],
        }),
      ).toBe(query);

      expect(
        applyFilterParameter(query, stageIndex, {
          target: ["dimension"],
          type: "category",
          value: ["foo"],
        }),
      ).toBe(query);

      expect(
        applyFilterParameter(query, stageIndex, {
          target: ["dimension", ["template-tag", "foo"]],
          type: "category",
          value: ["foo"],
        }),
      ).toBe(query);
    });

    it("should add a filter for a date parameter", () => {
      const newQuery = applyFilterParameter(query, stageIndex, {
        target: ["dimension", ["field", PRODUCTS.CREATED_AT, null]],
        type: "date/single",
        value: "01-01-2020",
      });
      const [filter] = Lib.filters(newQuery, -1);
      expect(Lib.displayInfo(query, stageIndex, filter)).toMatchObject({
        displayName: "Created At is on 01-01-2020",
      });
    });

    it("should add a relative date filter with an offset for a date parameter with a correct operator (metabase#49853)", () => {
      const newQuery = applyFilterParameter(query, stageIndex, {
        target: ["dimension", ["field", PRODUCTS.CREATED_AT, null]],
        type: "date/all-options",
        value: "past3months-from-9months",
      });
      const [filter] = Lib.filters(newQuery, stageIndex);
      expect(Lib.expressionParts(query, stageIndex, filter)).toMatchObject({
        operator: "relative-time-interval",
      });
      expect(Lib.displayInfo(query, stageIndex, filter)).toMatchObject({
        displayName:
          "Created At is in the previous 3 months, starting 9 months ago",
      });
    });

    it.each([
      {
        parameter: {
          target: ["dimension", ["field", PRODUCTS.CATEGORY, null]],
          type: "string/contains",
          value: "foo",
        },
        expectedDisplayName: "Category contains foo",
      },
      {
        parameter: {
          target: ["dimension", ["field", PRODUCTS.CATEGORY, null]],
          type: "string/contains",
          value: ["a", "b"],
        },
        expectedDisplayName: "Category contains 2 selections",
      },
      {
        parameter: {
          target: ["dimension", ["field", PRODUCTS.CATEGORY, null]],
          type: "string/starts-with",
          value: ["foo"],
        },
        expectedDisplayName: "Category starts with foo",
      },
    ])(
      "should add a filter for a string parameter",
      ({ parameter, expectedDisplayName }) => {
        const newQuery = applyFilterParameter(query, stageIndex, parameter);
        const [filter] = Lib.filters(newQuery, -1);
        expect(Lib.displayInfo(query, stageIndex, filter)).toMatchObject({
          displayName: expectedDisplayName,
        });
      },
    );

    it("should adda filter for a category parameter", () => {
      const newQuery = applyFilterParameter(query, stageIndex, {
        target: ["dimension", ["field", PRODUCTS.CATEGORY, null]],
        type: "category",
        value: ["foo", "bar"],
      });
      const [filter] = Lib.filters(newQuery, -1);
      expect(Lib.displayInfo(query, stageIndex, filter)).toMatchObject({
        displayName: "Category is 2 selections",
      });
    });

    it("should return mbql filter for number parameter", () => {
      const valueFilterQuery = applyFilterParameter(query, stageIndex, {
        target: ["dimension", ["field", PRODUCTS.RATING, null]],
        type: "number/=",
        value: 111,
      });
      const [valueFilter] = Lib.filters(valueFilterQuery, -1);
      expect(Lib.displayInfo(query, stageIndex, valueFilter)).toMatchObject({
        displayName: "Rating is equal to 111",
      });

      const arrayFilterQuery = applyFilterParameter(query, stageIndex, {
        target: ["dimension", ["field", PRODUCTS.RATING, null]],
        type: "number/=",
        value: [111],
      });
      const [arrayFilter] = Lib.filters(arrayFilterQuery, -1);
      expect(Lib.displayInfo(query, stageIndex, arrayFilter)).toMatchObject({
        displayName: "Rating is equal to 111",
      });

      const betweenFilterQuery = applyFilterParameter(query, stageIndex, {
        target: ["dimension", ["field", PRODUCTS.RATING, null]],
        type: "number/between",
        value: [1, 100],
      });
      const [betweenFilter] = Lib.filters(betweenFilterQuery, -1);
      expect(Lib.displayInfo(query, stageIndex, betweenFilter)).toMatchObject({
        displayName: "Rating is between 1 and 100",
      });
    });
  });
});
