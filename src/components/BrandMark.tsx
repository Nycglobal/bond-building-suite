export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale =
    size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-base" : "text-xl sm:text-2xl";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`wordmark ${scale} text-primary`}>Jewel Brillance</span>
      <span className="text-[0.6rem] tracking-[0.45em] text-muted-foreground uppercase">
        New York
      </span>
    </div>
  );
}
