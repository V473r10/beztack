export function AnimatedThis() {
  const gradientClass =
    "bg-linear-to-b from-accent via-accent to-accent/60 bg-clip-text text-transparent";

  return (
    <span className="group/this relative inline-flex cursor-pointer">
      {/* Static "th" - always visible */}
      <span className={gradientClass}>th</span>

      {/* Animated suffix container - uses grid to stack elements */}
      <span className="relative inline-grid">
        {/* "is" - visible by default, fades out on hover */}
        <span
          className={`col-start-1 row-start-1 transition-opacity duration-300 ease-out group-hover/this:opacity-0 ${gradientClass}`}
        >
          is
        </span>

        {/* "e Beztack" - hidden by default, fades in on hover */}
        <span
          className={`col-start-1 row-start-1 whitespace-nowrap opacity-0 transition-opacity duration-300 ease-out group-hover/this:opacity-100 ${gradientClass}`}
        >
          e Beztack
        </span>
      </span>
    </span>
  );
}
