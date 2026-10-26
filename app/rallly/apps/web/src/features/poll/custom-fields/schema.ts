import * as z from "zod";

// [projet] Custom participant fields (Rallly discussion #201): the poll
// creator asks voters for extra information (company, diet, phone…). The
// definitions live in `Poll.customFields` and the answers in
// `Participant.customAnswers`, both JSON validated here rather than by the
// database: the list is short and always read together with its poll.

export const MAX_CUSTOM_FIELDS = 5;
export const MAX_CUSTOM_FIELD_LABEL_LENGTH = 100;
export const MAX_CUSTOM_FIELD_CHOICES = 10;
export const MAX_CUSTOM_FIELD_CHOICE_LENGTH = 100;
// Same bound as response notes: answers are short context, not discussion.
export const MAX_CUSTOM_ANSWER_LENGTH = 500;

export const customFieldTypeSchema = z.enum(["text", "email", "select"]);

export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;

export const customFieldSchema = z
  .object({
    // Minted by the client when the field is added, so answers keep pointing
    // at the right field when the list is reordered or relabelled.
    id: z.string().regex(/^[\w-]{1,32}$/),
    label: z.string().trim().min(1).max(MAX_CUSTOM_FIELD_LABEL_LENGTH),
    type: customFieldTypeSchema,
    required: z.boolean(),
    choices: z
      .array(z.string().trim().min(1).max(MAX_CUSTOM_FIELD_CHOICE_LENGTH))
      .max(MAX_CUSTOM_FIELD_CHOICES)
      .default([]),
  })
  .transform((field) => ({
    ...field,
    // Choices only make sense for a select; drop leftovers from a type change.
    choices: field.type === "select" ? [...new Set(field.choices)] : [],
  }))
  .refine((field) => field.type !== "select" || field.choices.length >= 2, {
    message: "A choice list needs at least two choices",
    path: ["choices"],
  });

export type CustomField = z.infer<typeof customFieldSchema>;

export const customFieldsSchema = z
  .array(customFieldSchema)
  .max(MAX_CUSTOM_FIELDS)
  .refine(
    (fields) => new Set(fields.map((field) => field.id)).size === fields.length,
    { message: "Custom field ids must be unique" },
  );

// Answers sent by a voter, keyed by field id. Unknown ids are ignored by
// `validateCustomAnswers`, so only the shape and size are bounded here.
export const customAnswersInput = z
  .record(z.string().max(32), z.string().max(MAX_CUSTOM_ANSWER_LENGTH))
  .refine((answers) => Object.keys(answers).length <= MAX_CUSTOM_FIELDS * 2, {
    message: "Too many answers",
  });

export type CustomAnswers = Record<string, string>;
