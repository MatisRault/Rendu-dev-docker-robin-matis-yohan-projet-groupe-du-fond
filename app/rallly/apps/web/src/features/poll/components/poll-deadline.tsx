"use client";

import { Badge } from "@rallly/ui/badge";
import { HourglassIcon } from "lucide-react";
import { usePoll } from "@/features/poll/client";
import { EventMetaItem } from "@/features/poll/components/event-meta";
import { isPollExpired } from "@/features/poll/utils";
import { Trans } from "@/i18n/client";
import { useDateTime } from "@/lib/datetime/client";

/**
 * [projet] Expiration (#134): tells voters until when the poll takes
 * responses, or that it no longer does.
 */
export function PollDeadline() {
  const poll = usePoll();
  const { formatDateTime } = useDateTime();

  if (!poll.deadline) {
    return null;
  }

  const date = formatDateTime(poll.deadline, "datetime", {
    showTimeZone: true,
  });

  return (
    <EventMetaItem>
      <HourglassIcon />
      {isPollExpired(poll) ? (
        <span className="flex items-center gap-2">
          <Badge variant="destructive">
            <Trans i18nKey="pollDeadlineExpiredBadge" defaults="Expired" />
          </Badge>
          <Trans
            i18nKey="pollDeadlineExpiredOn"
            defaults="Responses closed on {date}"
            values={{ date }}
          />
        </span>
      ) : (
        <Trans
          i18nKey="pollDeadlineUntil"
          defaults="Responses accepted until {date}"
          values={{ date }}
        />
      )}
    </EventMetaItem>
  );
}
