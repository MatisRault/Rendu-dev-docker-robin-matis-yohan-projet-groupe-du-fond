import { describe, expect, it } from "vitest";
import type { BookingVote } from "./utils";
import { claimedOptionIds, validateBookingVotes } from "./utils";

const yes = (optionId: string): BookingVote => ({ optionId, type: "yes" });
const no = (optionId: string): BookingVote => ({ optionId, type: "no" });

describe("claimedOptionIds", () => {
  it("ne retient que les yes", () => {
    expect(claimedOptionIds([yes("a"), no("b"), yes("c")])).toEqual(["a", "c"]);
  });

  it("rend une liste vide quand rien n'est réservé", () => {
    expect(claimedOptionIds([no("a"), no("b")])).toEqual([]);
  });
});

describe("validateBookingVotes", () => {
  it("accepte de ne réserver aucun créneau", () => {
    expect(validateBookingVotes([no("a"), no("b")])).toBeNull();
  });

  it("accepte exactement un créneau", () => {
    expect(validateBookingVotes([yes("a"), no("b")])).toBeNull();
  });

  it("refuse deux créneaux", () => {
    expect(validateBookingVotes([yes("a"), yes("b")])).toEqual({
      code: "too_many_slots",
      claimed: 2,
    });
  });

  it("refuse ifNeedBe, qui n'a pas de sens pour une réservation", () => {
    expect(validateBookingVotes([{ optionId: "a", type: "ifNeedBe" }])).toEqual(
      {
        code: "unsupported_vote_type",
        type: "ifNeedBe",
      },
    );
  });

  it("signale le type non supporté avant le dépassement", () => {
    expect(
      validateBookingVotes([
        yes("a"),
        yes("b"),
        { optionId: "c", type: "ifNeedBe" },
      ]),
    ).toEqual({ code: "unsupported_vote_type", type: "ifNeedBe" });
  });
});
