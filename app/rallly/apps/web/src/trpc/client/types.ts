import type { PollStatus, VoteType } from "@rallly/database";

export type GetPollApiResponse = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  options: { id: string; startTime: Date; duration: number }[];
  user: {
    id: string;
    name: string;
    image: string | null;
    banned: boolean;
  } | null;
  timeZone: string | null;
  canManage: boolean;
  status: PollStatus;
  /** [projet] Réservation (#139) */
  bookingMode: boolean;
  createdAt: Date;
  deleted: boolean;
  event: {
    id: string;
    start: Date;
    duration: number;
    status: string;
  } | null;
};

export type Vote = {
  optionId: string;
  type: VoteType;
};
