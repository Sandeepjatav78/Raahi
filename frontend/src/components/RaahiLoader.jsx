/**
 * RaahiLoader - Compact creative loader
 * A clean motion-only animation for refresh and loading states.
 * Props:
 *   message  - optional text shown below the animation
 *   compact  - if true, renders a smaller inline animation
 */
const RaahiLoader = ({ compact = false }) => (
  <div className={compact ? 'tm-loader-compact' : 'tm-loader'}>
    <div className="tm-simple-loader">
      <div className="tm-simple-ring" />
      <div className="tm-simple-dot dot-a" />
      <div className="tm-simple-dot dot-b" />
      <div className="tm-simple-dot dot-c" />
      <div className="tm-simple-dot dot-d" />
    </div>
  </div>
);

export default RaahiLoader;