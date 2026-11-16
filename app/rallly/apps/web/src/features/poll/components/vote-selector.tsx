import type { VoteType } from "@rallly/database";
import { buttonVariants, cn } from "@rallly/ui";
import * as React from "react";

import { useTranslation } from "@/i18n/client";

import VoteIcon from "./vote-icon";

export interface VoteSelectorProps {
  value?: VoteType;
  /** [projet] Réservation (#139) : restreint le cycle à réservé / non réservé. */
  bookingMode?: boolean;
  /**
   * Accessible description of the option being voted on (e.g. "Tue 30 Jun
   * 2026, 1:00 PM – 2:00 PM") so screen readers can tie the vote to its
   * date/time.
   */
  optionLabel?: string;
  onChange?: (value: VoteType) => void;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  className?: string;
}

const orderedVoteTypes: VoteType[] = ["yes", "ifNeedBe", "no"];

/**
 * [projet] Réservation (#139) : « si nécessaire » n'a pas de sens quand un
 * créneau est attribué à une seule personne, et l'API le refuse. Le bouton
 * n'alterne donc qu'entre réservé et non réservé, pour que l'interface ne
 * propose jamais un choix que le serveur rejettera.
 */
const bookingVoteTypes: VoteType[] = ["yes", "no"];

const voteTypesFor = (bookingMode?: boolean) =>
  bookingMode ? bookingVoteTypes : orderedVoteTypes;

export const toggleVote = (value?: VoteType, bookingMode?: boolean) => {
  const types = voteTypesFor(bookingMode);
  if (!value) return types[0];
  const index = types.indexOf(value);
  // Une valeur hors du cycle (un ifNeedBe hérité d'avant l'activation du mode
  // réservation) repart proprement au début plutôt que de rester bloquée.
  if (index === -1) return types[0];
  return types[(index + 1) % types.length];
};

export const VoteSelector = React.forwardRef<
  HTMLButtonElement,
  VoteSelectorProps
>(function VoteSelector(
  {
    value,
    bookingMode,
    optionLabel,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    className,
  },
  ref,
) {
  const { t } = useTranslation();

  const voteLabel = (() => {
    switch (value) {
      case "yes":
        return t("yes", { defaultValue: "Yes" });
      case "ifNeedBe":
        return t("ifNeedBe", { defaultValue: "If need be" });
      case "no":
        return t("no", { defaultValue: "No" });
      default:
        return t("pending", { defaultValue: "Pending" });
    }
  })();

  return (
    <button
      data-testid="vote-selector"
      type="button"
      aria-label={optionLabel ? `${optionLabel}, ${voteLabel}` : voteLabel}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={cn(
        buttonVariants({
          size: "icon-sm",
        }),
        // The default variant's backdrop-blur and press-scale each make this
        // button a containing block, which would trap the after:inset-0 overlay
        // callers use to extend the tap target to the whole cell/row. The scale
        // applies only while pressed, so it collapses the overlay between
        // pointerdown and pointerup: the release lands on the parent and the
        // click never reaches this button.
        "backdrop-blur-none not-aria-[haspopup]:active:scale-none",
        className,
      )}
      onClick={() => {
        onChange?.(
          value ? toggleVote(value, bookingMode) : voteTypesFor(bookingMode)[0],
        );
      }}
      ref={ref}
    >
      <VoteIcon type={value} />
    </button>
  );
});
