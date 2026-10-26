import { describe, expect, it } from "vitest";
import type { CustomField } from "./schema";
import { customFieldSchema, customFieldsSchema } from "./schema";
import {
  escapeCsvValue,
  parseCustomAnswers,
  parseCustomFields,
  validateCustomAnswers,
} from "./utils";

const company: CustomField = {
  id: "company",
  label: "Company",
  type: "text",
  required: true,
  choices: [],
};
const contact: CustomField = {
  id: "contact",
  label: "Contact email",
  type: "email",
  required: false,
  choices: [],
};
const meal: CustomField = {
  id: "meal",
  label: "Meal",
  type: "select",
  required: false,
  choices: ["Vegetarian", "Standard"],
};

describe("validateCustomAnswers", () => {
  it("rejects a missing required answer", () => {
    expect(validateCustomAnswers([company], {})).toEqual({
      ok: false,
      error: { fieldId: "company", reason: "required" },
    });
  });

  it("treats a blank answer as missing", () => {
    expect(validateCustomAnswers([company], { company: "   " })).toEqual({
      ok: false,
      error: { fieldId: "company", reason: "required" },
    });
  });

  it("rejects a malformed email", () => {
    expect(
      validateCustomAnswers([contact], { contact: "not-an-email" }),
    ).toEqual({
      ok: false,
      error: { fieldId: "contact", reason: "invalidEmail" },
    });
  });

  it("rejects a choice that is not in the list", () => {
    expect(validateCustomAnswers([meal], { meal: "Pizza" })).toEqual({
      ok: false,
      error: { fieldId: "meal", reason: "invalidChoice" },
    });
  });

  it("keeps valid answers, trims them and drops unknown fields", () => {
    expect(
      validateCustomAnswers([company, contact, meal], {
        company: "  Ynov ",
        meal: "Vegetarian",
        injected: "ignored",
      }),
    ).toEqual({ ok: true, answers: { company: "Ynov", meal: "Vegetarian" } });
  });

  it("accepts anything when the poll has no fields", () => {
    expect(validateCustomAnswers([], { foo: "bar" })).toEqual({
      ok: true,
      answers: {},
    });
  });
});

describe("customFieldsSchema", () => {
  it("requires two choices for a select", () => {
    expect(
      customFieldSchema.safeParse({ ...meal, choices: ["Only one"] }).success,
    ).toBe(false);
  });

  it("drops choices when the field is not a select", () => {
    expect(
      customFieldSchema.parse({ ...company, choices: ["leftover"] }).choices,
    ).toEqual([]);
  });

  it("rejects duplicate ids and more than five fields", () => {
    expect(customFieldsSchema.safeParse([company, company]).success).toBe(
      false,
    );
    const six = Array.from({ length: 6 }, (_, i) => ({
      ...company,
      id: `f${i}`,
    }));
    expect(customFieldsSchema.safeParse(six).success).toBe(false);
  });
});

describe("parsing stored JSON", () => {
  it("reads invalid stored fields as no fields", () => {
    expect(parseCustomFields("garbage")).toEqual([]);
    expect(parseCustomFields([{ id: "x" }])).toEqual([]);
  });

  it("keeps only string answers", () => {
    expect(parseCustomAnswers({ a: "1", b: 2 })).toEqual({ a: "1" });
    expect(parseCustomAnswers(null)).toEqual({});
  });
});

describe("escapeCsvValue", () => {
  it("quotes values containing separators or quotes", () => {
    expect(escapeCsvValue("plain")).toBe("plain");
    expect(escapeCsvValue('a,"b"')).toBe('"a,""b"""');
  });
});
