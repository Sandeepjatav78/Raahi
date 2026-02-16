/**
 * TrackMateLoader — Premium branded loading animation
 * A bus moves along a curved SVG route with a pulsing destination dot.
 * Works in both light and dark mode via CSS custom properties.
 *
 * Props:
 *   message  — text shown below the animation (default: 'Connecting to live tracking...')
 *   compact  — if true, renders as inline card (no fullscreen background)
 */
const TrackMateLoader = ({ message = 'Connecting to live tracking...', compact = false }) => (
  <div className={compact ? 'tm-loader-compact' : 'tm-loader'}>
    <div className="tm-loader-card">
      {/* SVG Animation Scene */}
      <svg
        className="tm-loader-svg"
        viewBox="0 0 260 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Route path (curved line) */}
        <path
          className="tm-route-line"
          d="M 30 90 Q 80 20, 130 55 T 230 30"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Dashed progress overlay on same path */}
        <path
          className="tm-route-dash"
          d="M 30 90 Q 80 20, 130 55 T 230 30"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="8 6"
          fill="none"
        />

        {/* Start dot */}
        <circle className="tm-start-dot" cx="30" cy="90" r="4" />

        {/* Destination pulsing dot */}
        <circle className="tm-dest-pulse" cx="230" cy="30" r="10" />
        <circle className="tm-dest-dot" cx="230" cy="30" r="5" />

        {/* Bus icon that moves along the path */}
        <g className="tm-bus-group">
          <rect className="tm-bus-body" x="-11" y="-7" width="22" height="14" rx="3.5" />
          <rect className="tm-bus-window" x="-7" y="-5" width="5" height="5" rx="1.2" />
          <rect className="tm-bus-window" x="1" y="-5" width="5" height="5" rx="1.2" />
          <circle className="tm-bus-wheel" cx="-6" cy="7" r="2.2" />
          <circle className="tm-bus-wheel" cx="6" cy="7" r="2.2" />
        </g>
      </svg>

      {/* Text below */}
      <p className="tm-loader-text">{message}</p>

      {/* Subtle loading bar */}
      <div className="tm-loader-bar">
        <div className="tm-loader-bar-fill" />
      </div>
    </div>
  </div>
);

export default TrackMateLoader;
