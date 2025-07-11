const { H } = cy;
import { USERS } from "e2e/support/cypress_data";
import {
  ADMIN_PERSONAL_COLLECTION_ID,
  FIRST_COLLECTION_ID,
} from "e2e/support/cypress_sample_instance_data";

const { admin } = USERS;

describe("scenarios > organization > timelines > collection", () => {
  beforeEach(() => {
    H.restore();
    cy.intercept("PUT", "/api/collection/*").as("updateCollection");
    cy.intercept("POST", "/api/timeline").as("createTimeline");
    cy.intercept("PUT", "/api/timeline/*").as("updateTimeline");
    cy.intercept("DELETE", "/api/timeline/*").as("deleteTimeline");
    cy.intercept("POST", "/api/timeline-event").as("createEvent");
    cy.intercept("PUT", "/api/timeline-event/*").as("updateEvent");
    cy.intercept("DELETE", "/api/timeline-event/*").as("deleteEvent");
    cy.intercept("GET", "/api/timeline/*").as("getTimeline");
  });

  describe("as admin", () => {
    beforeEach(() => {
      cy.signInAsAdmin();
    });

    it("should create and edit an event with a date", () => {
      cy.visit("/collection/root");
      cy.findByTestId("collection-menu").icon("calendar").click();

      cy.button("Create event").click();
      cy.findByTestId("event-form").within(() => {
        cy.findByLabelText("Event name").type("RC1");

        cy.findByText(/via markdown/).should("be.visible");
        cy.findByLabelText("Description").type("*1.0-rc1* release");

        cy.findByLabelText("Date").clear().type("10/20/2026");

        cy.button("Create").click();
        cy.wait("@createEvent");
      });

      cy.findByTestId("event-list").within(() => {
        cy.findByText("RC1").should("be.visible");
        cy.findByText("October 20, 2026").should("be.visible");
        cy.icon("star").should("be.visible");
      });

      cy.button("Create event").click();

      cy.findByTestId("event-form").within(() => {
        cy.findByLabelText("Event name").type("RC2");
        cy.findByLabelText("Date").clear().type("5/12/2027");
        cy.findByText("Event name").click(); // blur
        cy.findByLabelText("Icon").click();
      });

      H.popover().findByText(/Cake/).click();
      cy.button("Create").click();
      cy.wait("@createEvent");

      cy.findByTestId("event-list").within(() => {
        cy.findByText("RC2").should("be.visible");
        cy.findByText("May 12, 2027").should("be.visible");
        cy.icon("cake").should("be.visible");
        cy.findByText("1.0-rc1").should("be.visible");
      });

      openMenu("RC1");
      H.popover().findByText("Edit event").click();
      cy.findByLabelText("Event name").clear().type("RC33");
      cy.button("Update").click();
      cy.wait("@updateEvent");

      cy.findByTestId("event-list").findByText("RC33").should("be.visible");
    });

    it("should create an event in a personal collection", () => {
      cy.visit(`/collection/${ADMIN_PERSONAL_COLLECTION_ID}`);
      cy.findByTestId("collection-menu").icon("calendar").click();

      cy.button("Create event").click();

      cy.findByTestId("event-form").within(() => {
        cy.findByLabelText("Event name").type("RC1");
        cy.findByLabelText("Date").clear().type("10/20/2026");
        cy.button("Create").click();
        cy.wait("@createEvent");
      });

      cy.findByTestId("event-list").findByText("RC1").should("be.visible");
    });

    it("should search for events", () => {
      H.createTimelineWithEvents({
        events: [
          { name: "RC1" },
          { name: "RC2" },
          { name: "v1.0" },
          { name: "v1.1" },
        ],
      });

      cy.visit("/collection/root/timelines");

      cy.findByPlaceholderText("Search for an event").type("V1");
      cy.findByTestId("event-list").within(() => {
        cy.findByText("v1.0").should("be.visible");
        cy.findByText("v1.1").should("be.visible");
        cy.findByText("RC1").should("not.exist");
        cy.findByText("RC2").should("not.exist");
      });
    });

    it("should create an event with date and time", () => {
      cy.visit("/collection/root/timelines");

      cy.button("Create event").click();
      cy.findByLabelText("Event name").type("RC1");

      cy.findByTestId("event-form").within(() => {
        cy.findByLabelText("Date").clear().type("10/20/2026");
        cy.button("Add time").click();
        cy.findByLabelText("Time").type("10:20");
        cy.findByText("Create").click();
        cy.wait("@createEvent");
      });

      H.modal().findByText("Our analytics events").should("be.visible");
      cy.findByTestId("event-list").within(() => {
        cy.findByText("RC1").should("be.visible");
        cy.findByText(/10:20 AM/).should("be.visible");
      });
    });

    it("should create an event with date and time at midnight", () => {
      cy.visit("/collection/root/timelines");

      cy.button("Create event").click();
      cy.findByLabelText("Event name").type("RC1");

      cy.findByTestId("event-form").within(() => {
        cy.findByLabelText("Date").clear().type("10/20/2026");
        cy.button("Add time").click();
        cy.findByLabelText("Time").type("00:00");
        cy.findByText("Create").click();
        cy.wait("@createEvent");
      });

      H.modal().findByText("Our analytics events").should("be.visible");
      cy.findByTestId("event-list").within(() => {
        cy.findByText("RC1").should("be.visible");
        cy.findByText(/12:00 AM/).should("be.visible");
      });
    });

    it("should move an event", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }],
      });
      H.createTimelineWithEvents({
        timeline: { name: "Metrics" },
        events: [{ name: "RC2" }],
      });

      cy.visit("/collection/root/timelines");
      H.modal().findByText("Metrics").click();
      openMenu("RC2");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Move event").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases").click();
      H.modal().button("Move").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC2").should("not.exist");

      cy.icon("chevronleft").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC1");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC2");
    });

    it("should move an event and undo", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }],
      });
      H.createTimelineWithEvents({
        timeline: { name: "Metrics" },
        events: [{ name: "RC2" }],
      });

      cy.visit("/collection/root/timelines");
      H.modal().findByText("Metrics").click();
      openMenu("RC2");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Move event").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases").click();
      H.modal().button("Move").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC2").should("not.exist");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Undo").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC2").should("be.visible");
    });

    it("should archive an event when editing this event", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }, { name: "RC2" }],
      });

      cy.visit("/collection/root/timelines");

      openMenu("RC1");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Edit event").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Archive event").click();
      cy.wait("@updateEvent");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC1").should("not.exist");
    });

    it("should archive an event from the timeline and undo", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }, { name: "RC2" }],
      });

      cy.visit("/collection/root/timelines");

      openMenu("RC1");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Archive event").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC1").should("not.exist");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Undo").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC1").should("be.visible");
    });

    it("should unarchive an event from the archive and undo", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1", archived: true }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("View archived events").click();

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Archived events").should("be.visible");
      openMenu("RC1");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Unarchive event").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("No events found").should("be.visible");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Undo").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC1").should("be.visible");
    });

    it("should delete an event", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1", archived: true }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("View archived events").click();

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Archived events").should("be.visible");
      openMenu("RC1");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Delete event").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Delete").click();
      cy.wait("@deleteEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("No events found").should("be.visible");
    });

    it("should allow navigating back to the list of timelines", () => {
      H.createTimeline({ name: "Releases" });
      H.createTimeline({ name: "Metrics" });

      cy.visit("/collection/root/timelines/1");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases");

      cy.icon("chevronleft").click();
      H.modal().findByText("Releases");
      H.modal().findByText("Metrics");
    });

    it("should not allow navigating back when there is only one timeline in a collection", () => {
      H.createTimeline({ name: "Releases" });

      cy.visit("/collection/root/timelines/1");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases");
      cy.icon("chevronleft").should("not.exist");
    });

    it("should create an additional timeline", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("New timeline").click();
      cy.findByLabelText("Name").type("Launches");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Create").click();
      cy.wait("@createTimeline");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Launches").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Create event").should("be.visible");
    });

    it("should edit a timeline", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Edit timeline details").click();
      cy.findByLabelText("Name").clear().type("Launches");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Update").click();
      cy.wait("@updateTimeline");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Launches").should("be.visible");
    });

    it("should move a timeline", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Events", default: true },
        events: [{ name: "RC1" }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Our analytics events");
      H.popover().findByText("Move timeline").click();

      H.entityPickerModal().within(() => {
        cy.findByRole("tab", { name: /Collections/ }).click();
        cy.findByText("Bobby Tables's Personal Collection").click();
        cy.button("Move").click();
        cy.wait("@updateTimeline");
      });

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Our analytics events").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText(`${H.getFullName(admin)}'s Personal Collection`).should(
        "be.visible",
      );
    });

    it("should archive a timeline and undo", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }, { name: "RC2" }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Edit timeline details").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Archive timeline and all events").click();
      cy.wait("@updateTimeline");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Our analytics events").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Create event").should("be.visible");

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Undo").click();
      cy.wait("@updateTimeline");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC1").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("RC2").should("be.visible");
    });

    it("should support markdown in timeline description", () => {
      H.createTimeline({
        name: "Releases",
        description: "[Release notes](https://metabase.test)",
      });

      H.createTimeline({
        name: "Holidays",
        description: "[Holiday list](https://metabase.test)",
      });

      cy.visit("/collection/root/timelines");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Release notes").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Holiday list").should("be.visible");
    });

    it("should support markdown in event description", () => {
      H.createTimelineWithEvents({
        timeline: {
          name: "Releases",
        },
        events: [
          {
            name: "RC1",
            description: "[Release notes](https://metabase.test)",
          },
        ],
      });

      cy.visit("/collection/root/timelines");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Release notes").should("be.visible");
    });

    it("should archive and unarchive a timeline", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }, { name: "RC2" }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Edit timeline details").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Archive timeline and all events").click();
      cy.wait("@updateTimeline");

      openMenu("Our analytics events");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("View archived timelines").click();

      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Unarchive timeline").click();
      cy.wait("@updateTimeline");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("No timelines found");
      H.modal().icon("chevronleft").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases");
    });

    it("should archive and delete a timeline", () => {
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }, { name: "RC2" }],
      });

      cy.visit("/collection/root/timelines");
      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Edit timeline details").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Archive timeline and all events").click();
      cy.wait("@updateTimeline");

      openMenu("Our analytics events");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("View archived timelines").click();

      openMenu("Releases");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Delete timeline").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Delete").click();
      cy.wait("@deleteTimeline");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("No timelines found");
      H.modal().icon("chevronleft").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Our analytics events");
    });

    it("should preserve collection names for default timelines", () => {
      cy.visit(`/collection/${FIRST_COLLECTION_ID}/timelines`);

      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Create event").click();
      cy.findByLabelText("Event name").type("RC1");
      cy.findByLabelText("Date").type("10/20/2026");
      cy.button("Create").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("First collection events");
      cy.wait("@createTimeline");
      cy.icon("close").click();

      cy.findByDisplayValue("First collection")
        .clear()
        .type("1st collection")
        .blur();
      cy.wait("@updateCollection");

      cy.icon("calendar").click();
      openMenu("1st collection events");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Edit timeline details").click();
      cy.findByLabelText("Name").clear().type("Releases");
      cy.button("Update").click();
      cy.wait("@updateTimeline");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases");
    });

    it("should use custom date formatting settings", () => {
      H.createTimelineWithEvents({
        events: [{ name: "RC1", timestamp: "2022-10-12T18:15:30Z" }],
      });
      setFormattingSettings({
        "type/Temporal": { date_style: "YYYY/M/D" },
      });
      cy.visit("/collection/root/timelines");

      openMenu("RC1");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Edit event").click();
      cy.findByDisplayValue("2022/10/12").should("be.visible");

      cy.findByLabelText("Date").clear().type("2022/10/15");
      cy.button("Update").click();
      cy.wait("@updateEvent");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("2022/10/15").should("be.visible");
    });

    it("should use custom time formatting settings", () => {
      H.createTimelineWithEvents({
        events: [
          {
            name: "RC1",
            timestamp: "2022-10-12T18:15:30Z",
            time_matters: true,
          },
        ],
      });
      setFormattingSettings({
        "type/Temporal": { time_style: "HH:mm" },
      });
      cy.visit("/collection/root/timelines");
      cy.wait("@getTimeline");

      cy.findByTestId("event-list")
        .findByText("October 12, 2022, 18:15")
        .should("be.visible");
    });
  });

  describe("as readonly user", () => {
    it("should not allow creating new timelines in collections", () => {
      cy.signIn("readonly");
      cy.visit("/collection/root");

      cy.icon("calendar").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Our analytics events").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Create event").should("not.exist");
    });

    it("should not allow creating new events in existing timelines", () => {
      cy.signInAsAdmin();
      H.createTimelineWithEvents({
        timeline: { name: "Releases" },
        events: [{ name: "RC1" }],
      });
      cy.signOut();

      cy.signIn("readonly");
      cy.visit("/collection/root");
      cy.icon("calendar").click();
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Releases").should("be.visible");
      // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
      cy.findByText("Create event").should("not.exist");
    });
  });
});

H.describeWithSnowplow("scenarios > collections > timelines", () => {
  beforeEach(() => {
    H.restore();
    H.resetSnowplow();
    cy.signInAsAdmin();
    H.enableTracking();
  });

  afterEach(() => {
    H.expectNoBadSnowplowEvents();
  });

  it("should send snowplow events when creating a timeline event", () => {
    cy.visit("/collection/root");
    H.expectSnowplowEvent({
      eventType: "page_view",
      event: {
        page_urlpath: "/collection/root",
      },
    });

    cy.icon("calendar").click();
    H.expectSnowplowEvent({
      eventType: "page_view",
      event: {
        page_urlpath: "/collection/root/timelines",
      },
    });

    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Create event").click();
    cy.findByLabelText("Event name").type("Event");
    cy.findByLabelText("Date").type("10/20/2026");
    H.expectSnowplowEvent({
      eventType: "page_view",
      event: {
        page_urlpath: "/collection/root/timelines/new/events/new",
      },
    });

    cy.button("Create").click();
    H.expectSnowplowEvent({
      event: {
        unstruct_event: {
          data: {
            data: {
              event: "new_event_created",
            },
          },
        },
      },
    });

    H.expectSnowplowEvent(
      {
        eventType: "page_view",
        event: {
          page_urlpath: "/collection/root/timelines",
        },
      },
      2,
    ); // we viewed this page twice
  });
});

const openMenu = (name) => {
  return cy.findByText(name).parent().parent().icon("ellipsis").click();
};

const setFormattingSettings = (settings) => {
  cy.request("PUT", "api/setting/custom-formatting", {
    value: settings,
  });
};
