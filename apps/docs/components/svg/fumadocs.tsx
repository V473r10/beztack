export const FumaDocsIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      fill="none"
      height="80"
      viewBox="0 0 180 180"
      width="80"
    >
      <circle
        cx="90"
        cy="90"
        fill="url(#fumadocs-gradient)"
        r="89"
        stroke="#fbbf24"
        strokeWidth="1"
      />
      <defs>
        <linearGradient gradientTransform="rotate(45)" id="fumadocs-gradient">
          <stop offset="45%" stopColor="#1c1917" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
    </svg>
  );
};
