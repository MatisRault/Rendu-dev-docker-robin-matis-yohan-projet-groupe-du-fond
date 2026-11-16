import { describe, expect, it } from "vitest";
import {
  fromDateTimeLocalValue,
  isPollAcceptingResponses,
  isPollExpired,
  toDateTimeLocalValue,
} from "./utils";

const now = new Date("2026-10-26T12:00:00Z");

describe("isPollExpired", () => {
  it("never expires without a deadline", () => {
    expect(isPollExpired({ deadline: null }, now)).toBe(false);
  });

  it("is not expired before the deadline", () => {
    expect(
      isPollExpired({ deadline: new Date("2026-10-26T12:00:01Z") }, now),
    ).toBe(false);
  });

  it("is expired at and after the deadline", () => {
    expect(isPollExpired({ deadline: now }, now)).toBe(true);
    expect(
      isPollExpired({ deadline: new Date("2026-10-25T00:00:00Z") }, now),
    ).toBe(true);
  });
});

describe("isPollAcceptingResponses", () => {
  const future = new Date("2026-11-01T00:00:00Z");
  const past = new Date("2026-10-01T00:00:00Z");

  it("accepts responses when open and before the deadline", () => {
    expect(
      isPollAcceptingResponses({ status: "open", deadline: null }, now),
    ).toBe(true);
    expect(
      isPollAcceptingResponses({ status: "open", deadline: future }, now),
    ).toBe(true);
  });

  it("refuses responses once the deadline has passed", () => {
    expect(
      isPollAcceptingResponses({ status: "open", deadline: past }, now),
    ).toBe(false);
  });

  it("refuses responses when the poll is not open", () => {
    expect(
      isPollAcceptingResponses({ status: "closed", deadline: future }, now),
    ).toBe(false);
  });
});

describe("datetime-local conversion", () => {
  it("round-trips a local wall time", () => {
    const value = "2026-11-02T18:30";
    const date = fromDateTimeLocalValue(value);
    expect(date).not.toBeNull();
    expect(toDateTimeLocalValue(date)).toBe(value);
  });

  it("treats empty or invalid input as no deadline", () => {
    expect(fromDateTimeLocalValue("")).toBeNull();
    expect(fromDateTimeLocalValue("not a date")).toBeNull();
    expect(toDateTimeLocalValue(null)).toBe("");
  });
});
