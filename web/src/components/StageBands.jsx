/** Shared Merck-style color bands for Portal / Login */
export default function StageBands() {
  return (
    <div className="stage-bands" aria-hidden>
      <div className="stage-band stage-band-purple" />
      <div className="stage-band stage-band-lime">
        <svg className="stage-wave" viewBox="0 0 1440 180" preserveAspectRatio="none">
          <path
            fill="currentColor"
            d="M0,40 C220,120 380,10 560,70 C780,140 980,20 1180,80 C1300,110 1380,90 1440,70 L1440,180 L0,180 Z"
          />
        </svg>
      </div>
      <div className="stage-band stage-band-emerald" />
      <div className="stage-blob stage-blob-a" />
      <div className="stage-blob stage-blob-b" />
    </div>
  );
}
