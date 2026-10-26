import { customAlphabet } from "nanoid";

// Alphanumeric only: url safe with no linkifier edge cases. 32 chars is the
// floor documented on Participant.token and PollInvite.token.
export const generateAccessToken = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  32,
);

/**
 * Confirmation emails sent before responses carried their own token linked
 * to an iron-session seal of the guest's user id. Seals are self describing,
 * so the branch is picked by prefix without a failed lookup.
 */
export function isLegacyEditToken(token: string) {
  return token.startsWith("Fe26.2*");
}

/**
 * [projet] Expiration (discussion #134). A poll takes responses while it is
 * open and its optional deadline is still ahead. The deadline is checked at
 * request time, so it holds even when no cron job closes the poll.
 */
export function isPollExpired(
  poll: { deadline: Date | null },
  now: Date = new Date(),
) {
  return poll.deadline !== null && poll.deadline.getTime() <= now.getTime();
}

export function isPollAcceptingResponses(
  poll: { status: string; deadline: Date | null },
  now: Date = new Date(),
) {
  return poll.status === "open" && !isPollExpired(poll, now);
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * [projet] Value for an `<input type="datetime-local">`, in the browser's
 * time zone. Empty string means no deadline.
 */
export function toDateTimeLocalValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** [projet] Inverse of `toDateTimeLocalValue`: local wall time → instant. */
export function fromDateTimeLocalValue(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
