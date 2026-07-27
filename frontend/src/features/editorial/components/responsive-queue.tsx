import { cn } from "@/lib/utils";

type ResponsiveQueueProps = {
  cards: React.ReactNode;
  table: React.ReactNode;
  tableFrom?: "lg" | "xl";
};

const TABLE_BREAKPOINT = {
  lg: "lg:block",
  xl: "xl:block",
} as const;

const CARD_BREAKPOINT = {
  lg: "lg:hidden",
  xl: "xl:hidden",
} as const;

export function ResponsiveQueue({
  cards,
  table,
  tableFrom = "lg",
}: ResponsiveQueueProps) {
  return (
    <>
      <div
        className={cn(
          "hidden overflow-x-auto",
          TABLE_BREAKPOINT[tableFrom],
        )}
      >
        {table}
      </div>
      <div className={cn("divide-y", CARD_BREAKPOINT[tableFrom])}>{cards}</div>
    </>
  );
}
