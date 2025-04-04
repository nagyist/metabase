import userEvent from "@testing-library/user-event";
import mockDate from "mockdate";
import moment from "moment-timezone"; // eslint-disable-line no-restricted-imports -- deprecated usage

import { render, screen } from "__support__/ui";
import { updateStartOfWeek } from "metabase/lib/i18n";

import type { CalendarProps } from "./Calendar";
import Calendar from "./Calendar";

describe("Calendar", () => {
  afterEach(() => {
    mockDate.reset();
  });

  it("should switch months correctly", async () => {
    mockDate.set("2018-01-12T12:00:00Z", 0);
    setup({ selected: moment("2018-01-01") });

    const PREVIOUS = screen.getByRole("img", { name: /chevronleft icon/i });
    const NEXT = screen.getByRole("img", { name: /chevronright icon/i });

    expect(screen.getByText("January 2018")).toBeInTheDocument();

    await userEvent.click(PREVIOUS);
    expect(screen.getByText("December 2017")).toBeInTheDocument();

    await userEvent.click(NEXT);
    await userEvent.click(NEXT);
    expect(screen.getByText("February 2018")).toBeInTheDocument();
  });

  it("should render all days of current month by default", () => {
    mockDate.set("2023-03-31T12:00:00Z", 0);
    setup();

    // check that listed dates are correct
    expect(screen.getByTestId("calendar-weeks")).toHaveTextContent(
      [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
      ].join(""), // days in March 2023
    );
  });

  it("should render weekday short names", () => {
    setup();

    expect(
      screen
        .getAllByTestId("calendar-day-name")
        .map((dayEl) => dayEl.textContent),
    ).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
  });

  describe('with custom "start-of-week" setting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-03-23T08:00:00"));

      updateStartOfWeek("wednesday");
    });

    afterEach(() => {
      updateStartOfWeek("sunday");

      jest.useRealTimers();
    });

    it("should render days based on first day of the week settings", () => {
      setup();

      expect(
        screen
          .getAllByTestId("calendar-day-name")
          .map((dayEl) => dayEl.textContent),
      ).toEqual(["We", "Th", "Fr", "Sa", "Su", "Mo", "Tu"]);

      // check that listed dates are correct and start with proper day-of-week
      expect(screen.getByTestId("calendar-weeks")).toHaveTextContent(
        [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
          21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4,
        ].join(""), // days in March 2023 + days of the first week of April until Wednesday (not including it)
      );
    });
  });
});

function setup(props?: Partial<CalendarProps>) {
  return render(<Calendar {...props} />);
}
