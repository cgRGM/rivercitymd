import { describe, expect, test } from "vitest";

import { buildBusinessHoursForm } from "./business-hours";

describe("buildBusinessHoursForm", () => {
  test("returns the default weekly schedule when no saved hours exist", () => {
    const schedule = buildBusinessHoursForm();

    expect(schedule).toHaveLength(7);
    expect(schedule[0]).toMatchObject({
      day: "Sunday",
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "17:00",
      isActive: false,
    });
    expect(schedule[1]).toMatchObject({
      day: "Monday",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
    });
  });

  test("maps persisted availability into the full weekly schedule", () => {
    const schedule = buildBusinessHoursForm([
      {
        dayOfWeek: 1,
        startTime: "08:30",
        endTime: "16:30",
        isActive: true,
      },
      {
        dayOfWeek: 6,
        startTime: "10:00",
        endTime: "14:00",
        isActive: false,
      },
    ]);

    expect(schedule[1]).toMatchObject({
      day: "Monday",
      dayOfWeek: 1,
      startTime: "08:30",
      endTime: "16:30",
      isActive: true,
    });
    expect(schedule[6]).toMatchObject({
      day: "Saturday",
      dayOfWeek: 6,
      startTime: "10:00",
      endTime: "14:00",
      isActive: false,
    });
    expect(schedule[2]).toMatchObject({
      day: "Tuesday",
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
    });
  });
});
