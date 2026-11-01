export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="chart">
      {values.length > 1 ? (
        <svg
          viewBox="0 0 300 80"
          role="img"
          aria-label="Recent request latency"
        >
          <path
            d="M0 75 H300 M0 40 H300 M0 5 H300"
            stroke="var(--line)"
            strokeDasharray="3 5"
          />
          <polyline
            points={values
              .map(
                (v, i) =>
                  `${(i / (values.length - 1)) * 300},${75 - (v / max) * 65}`,
              )
              .join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <span>Latency history appears after requests complete.</span>
      )}
    </div>
  );
}
