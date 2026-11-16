/**
 * [projet] Mode réservation (discussion Rallly #139).
 *
 * Deux règles, de nature différente :
 *
 *  1. « un seul créneau par participant » se vérifie sur la seule requête,
 *     sans toucher la base : c'est ce module ;
 *  2. « un seul participant par créneau » dépend des votes déjà enregistrés,
 *     donc d'un état partagé et concurrent : voir `./mutations.ts`.
 *
 * Séparer les deux garde la première testable sans base de données.
 */

/**
 * Reprend l'énumération de l'entrée tRPC plutôt que le type Prisma :
 * `features/**` n'a pas le droit d'importer `@rallly/database` hors de
 * `data.ts` et `mutations.ts`.
 */
export type BookingVoteType = "yes" | "no" | "ifNeedBe";

export type BookingVote = { optionId: string; type: BookingVoteType };

/** Un participant ne peut réserver qu'un créneau. */
export const MAX_SLOTS_PER_PARTICIPANT = 1;

/**
 * Les créneaux que ce vote revendique. En mode réservation, seul un `yes`
 * réserve : `no` est l'absence de réservation.
 */
export function claimedOptionIds(votes: BookingVote[]): string[] {
  return votes
    .filter((vote) => vote.type === "yes")
    .map((vote) => vote.optionId);
}

export type BookingRuleViolation =
  | { code: "too_many_slots"; claimed: number }
  | { code: "unsupported_vote_type"; type: BookingVoteType }
  | { code: "slot_taken"; optionIds: string[] };

/**
 * Valide une sélection en mode réservation, indépendamment de la base.
 *
 * `ifNeedBe` est refusé : « si nécessaire » n'a pas de sens quand un créneau
 * est attribué à une personne et une seule. L'accepter laisserait croire
 * qu'une réservation est prise alors qu'elle ne l'est pas.
 *
 * Ne rien réserver reste permis : on ne force personne à prendre un créneau.
 */
export function validateBookingVotes(
  votes: BookingVote[],
): BookingRuleViolation | null {
  const unsupported = votes.find((vote) => vote.type === "ifNeedBe");
  if (unsupported) {
    return { code: "unsupported_vote_type", type: unsupported.type };
  }

  const claimed = claimedOptionIds(votes).length;
  if (claimed > MAX_SLOTS_PER_PARTICIPANT) {
    return { code: "too_many_slots", claimed };
  }

  return null;
}

/**
 * Code applicatif associé à la violation. Il suit le mécanisme déjà utilisé
 * par `POLL_FULL` : le client le lit dans `error.data.appError` et affiche
 * un message traduit, au lieu du texte anglais du serveur ou d'un message
 * générique parlant de connexion réseau.
 */
export function bookingViolationAppCode(
  violation: BookingRuleViolation,
): "SLOT_TAKEN" | "BOOKING_LIMIT" {
  return violation.code === "slot_taken" ? "SLOT_TAKEN" : "BOOKING_LIMIT";
}

/** Message rendu à l'appelant de l'API. Volontairement explicite. */
export function bookingViolationMessage(
  violation: BookingRuleViolation,
): string {
  switch (violation.code) {
    case "too_many_slots":
      return `This poll is in booking mode: you may book at most ${MAX_SLOTS_PER_PARTICIPANT} slot (received ${violation.claimed})`;
    case "unsupported_vote_type":
      return 'This poll is in booking mode: a slot is either booked or not, "if need be" is not accepted';
    case "slot_taken":
      return "This slot has already been booked by someone else. Pick another one.";
  }
}
