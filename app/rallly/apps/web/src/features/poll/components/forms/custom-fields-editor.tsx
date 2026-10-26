"use client";

// [projet] Editor for the custom participant fields (Rallly discussion #201).

import { Button } from "@rallly/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@rallly/ui/field";
import { Input } from "@rallly/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rallly/ui/select";
import { Switch } from "@rallly/ui/switch";
import { Textarea } from "@rallly/ui/textarea";
import { nanoid } from "@rallly/utils/nanoid";
import { ListPlusIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { SettingIcon } from "@/components/setting-icon";
import type { PollSettingsFormData } from "@/features/poll/components/forms/types";
import type { CustomFieldType } from "@/features/poll/custom-fields/schema";
import {
  MAX_CUSTOM_FIELD_LABEL_LENGTH,
  MAX_CUSTOM_FIELDS,
} from "@/features/poll/custom-fields/schema";
import { Trans, useTranslation } from "@/i18n/client";

export function CustomFieldsEditor() {
  const { t } = useTranslation();
  const form = useFormContext<PollSettingsFormData>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "customFields",
    keyName: "key",
  });

  const typeLabels: Record<CustomFieldType, string> = {
    text: t("customFieldTypeText", { defaultValue: "Text" }),
    email: t("customFieldTypeEmail", { defaultValue: "Email" }),
    select: t("customFieldTypeSelect", { defaultValue: "Choice list" }),
  };

  return (
    <Field>
      <div className="flex items-start gap-3">
        <SettingIcon>
          <ListPlusIcon />
        </SettingIcon>
        <FieldContent>
          <FieldLabel>
            <Trans i18nKey="customFieldsTitle" defaults="Custom fields" />
          </FieldLabel>
          <FieldDescription>
            <Trans
              i18nKey="customFieldsDescription"
              defaults="Ask participants for extra information. Only you can see their answers."
            />
          </FieldDescription>
        </FieldContent>
      </div>
      {fields.map((item, index) => {
        const type = form.watch(`customFields.${index}.type`);
        return (
          <div
            key={item.key}
            className="space-y-2 rounded-lg border p-3"
            data-testid="custom-field"
          >
            <div className="flex gap-2">
              <Input
                className="flex-1"
                maxLength={MAX_CUSTOM_FIELD_LABEL_LENGTH}
                aria-label={t("customFieldLabel", { defaultValue: "Label" })}
                placeholder={t("customFieldLabelPlaceholder", {
                  defaultValue: "e.g. Company",
                })}
                {...form.register(`customFields.${index}.label`)}
              />
              <Controller
                control={form.control}
                name={`customFields.${index}.type`}
                render={({ field }) => (
                  <Select
                    items={Object.entries(typeLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) {
                        field.onChange(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("customFieldRemove", {
                  defaultValue: "Remove field",
                })}
                onClick={() => remove(index)}
              >
                <TrashIcon />
              </Button>
            </div>
            {type === "select" ? (
              <Controller
                control={form.control}
                name={`customFields.${index}.choices`}
                render={({ field }) => (
                  <Textarea
                    rows={3}
                    aria-label={t("customFieldChoices", {
                      defaultValue: "Choices",
                    })}
                    placeholder={t("customFieldChoicesPlaceholder", {
                      defaultValue: "One choice per line",
                    })}
                    value={(field.value ?? []).join("\n")}
                    onChange={(e) => field.onChange(e.target.value.split("\n"))}
                  />
                )}
              />
            ) : null}
            <Controller
              control={form.control}
              name={`customFields.${index}.required`}
              render={({ field }) => (
                <div className="flex items-center gap-2 text-sm">
                  <Switch
                    id={`custom-field-required-${item.id}`}
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                  />
                  <label htmlFor={`custom-field-required-${item.id}`}>
                    <Trans i18nKey="customFieldRequired" defaults="Required" />
                  </label>
                </div>
              )}
            />
          </div>
        );
      })}
      {fields.length < MAX_CUSTOM_FIELDS ? (
        <Button
          type="button"
          size="sm"
          onClick={() =>
            append({
              id: nanoid(),
              label: "",
              type: "text",
              required: false,
              choices: [],
            })
          }
        >
          <PlusIcon />
          <Trans i18nKey="customFieldAdd" defaults="Add field" />
        </Button>
      ) : null}
    </Field>
  );
}
