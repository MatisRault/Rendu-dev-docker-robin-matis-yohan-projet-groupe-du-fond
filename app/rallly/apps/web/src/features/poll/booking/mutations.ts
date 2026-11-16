import { Prisma } from "@rallly/database";
import type { BookingRuleViolation } from "./utils";

/**
 * [projet] Mode réservation (discussion Rallly #139) — règle « un seul
 * participant par créneau ».
 *
 * Cette règle porte sur un état partagé : deux personnes peuvent demander le
 * même créneau au même instant. Un simple `count` suivi d'un `insert` ne
 * suffirait pas — en isolation READ COMMITTED, les deux transactions liraient
 * « zéro réservation » avant que l'une n'écrive, et le créneau partirait deux
 * fois.
 *
 * On verrouille donc les lignes `options` concernées avec `FOR UPDATE` avant
 * de compter. La seconde transaction attend la fin de la première, puis voit
 * sa réservation et la refuse. `ORDER BY id` donne un ordre de verrouillage
 * stable, ce qui évite l'interblocage quand deux requêtes concurrentes portent
 * sur plusieurs créneaux.
 *
 * Limite assumée : la garantie tient parce que **toutes** les écritures de
 * vote passent par ici. Une écriture directe en base la contournerait, faute
 * d'index unique partiel — un tel index porterait sur toute la table `votes`
 * et s'appliquerait aussi aux sondages ordinaires, où plusieurs personnes
 * doivent pouvoir répondre « oui » au même créneau.
 *
 * Rend la violation au lieu de la lever : la traduction en erreur HTTP est
 * l'affaire du routeur, pas de la couche d'accès aux données.
 */
export async function findBookingConflict(
  tx: Prisma.TransactionClient,
  {
    optionIds,
    excludeParticipantId,
  }: { optionIds: string[]; excludeParticipantId?: string },
): Promise<BookingRuleViolation | null> {
  if (optionIds.length === 0) {
    return null;
  }

  // Verrou pessimiste : sérialise les réservations concurrentes du même créneau.
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM options WHERE id IN (${Prisma.join(
      optionIds,
    )}) ORDER BY id FOR UPDATE`,
  );

  const taken = await tx.vote.findMany({
    where: {
      optionId: { in: optionIds },
      type: "yes",
      // Modifier sa propre réservation ne doit pas se heurter à soi-même.
      ...(excludeParticipantId
        ? { participantId: { not: excludeParticipantId } }
        : {}),
    },
    select: { optionId: true },
  });

  if (taken.length === 0) {
    return null;
  }

  return {
    code: "slot_taken",
    optionIds: [...new Set(taken.map((vote) => vote.optionId))],
  };
}
