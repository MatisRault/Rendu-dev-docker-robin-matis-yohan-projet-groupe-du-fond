import * as z from "zod";
import type { CustomAnswers, CustomField } from "./schema";
import { customFieldsSchema } from "./schema";

// Rows written before the feature, or by hand, must never break a poll page:
// anything that does not parse reads as "no custom fields".
export function parseCustomFields(value: unknown): CustomField[] {
  const result = customFieldsSchema.safeParse(value);
  return result.success ? result.data : [];
}

export function parseCustomAnswers(value: unknown): CustomAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

// The editor keeps half typed rows (empty label, blank choice lines) while
// the creator types; drop them before the fields are sent to the server.
export function cleanCustomFields(fields: CustomField[]): CustomField[] {
  return fields
    .map((field) => ({
      ...field,
      label: field.label.trim(),
      choices:
        field.type === "select"
          ? field.choices.map((choice) => choice.trim()).filter(Boolean)
          : [],
    }))
    .filter((field) => field.label);
}

export type CustomAnswerError = {
  fieldId: string;
  reason: "required" | "invalidEmail" | "invalidChoice";
};

const emailSchema = z.email();

/**
 * Server side check of a voter's answers against the poll's fields: required
 * fields must be filled, emails well formed and choices taken from the list.
 * Answers to unknown fields are dropped and blank answers are not stored.
 */
export function validateCustomAnswers(
  fields: CustomField[],
  answers: CustomAnswers = {},
):
  | { ok: true; answers: CustomAnswers }
  | { ok: false; error: CustomAnswerError } {
  const cleaned: CustomAnswers = {};

  for (const field of fields) {
    const value = answers[field.id]?.trim() ?? "";

    if (!value) {
      if (field.required) {
        return { ok: false, error: { fieldId: field.id, reason: "required" } };
      }
      continue;
    }

    if (field.type === "email" && !emailSchema.safeParse(value).success) {
      return {
        ok: false,
        error: { fieldId: field.id, reason: "invalidEmail" },
      };
    }

    if (field.type === "select" && !field.choices.includes(value)) {
      return {
        ok: false,
        error: { fieldId: field.id, reason: "invalidChoice" },
      };
    }

    cleaned[field.id] = value;
  }

  return { ok: true, answers: cleaned };
}

// RFC 4180 quoting: answers are free text and may contain commas or quotes.
export function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
