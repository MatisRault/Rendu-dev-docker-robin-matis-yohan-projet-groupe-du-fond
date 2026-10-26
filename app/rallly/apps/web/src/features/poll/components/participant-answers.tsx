"use client";

// [projet] Shows a respondent's answers to the custom fields (#201). The
// server only sends answers to the host, so for anyone else this renders
// nothing.

import { Button } from "@rallly/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rallly/ui/popover";
import { ListChecksIcon } from "lucide-react";
import { usePoll } from "@/features/poll/client";
import { useTranslation } from "@/i18n/client";

export function ParticipantAnswers({
  answers,
  participantName,
  size = "icon-xs",
}: {
  answers: Record<string, string>;
  participantName: string;
  size?: "icon" | "icon-xs";
}) {
  const { t } = useTranslation();
  const poll = usePoll();
  const rows = poll.customFields
    .filter((field) => answers[field.id])
    .map((field) => ({ label: field.label, value: answers[field.id] }));

  if (rows.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={t("participantAnswersButton", {
              defaultValue: "Read answers from {name}",
              name: participantName,
            })}
            size={size}
            variant="ghost"
          >
            <ListChecksIcon />
          </Button>
        }
      />
      <PopoverContent>
        <dl className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-muted-foreground text-xs">{row.label}</dt>
              <dd className="whitespace-pre-wrap break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
