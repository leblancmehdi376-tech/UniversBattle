export default function Stage({ stageKey, children }) {
  // La key force React à remonter le contenu à chaque changement de phase,
  // ce qui relance l'animation CSS définie sur .stage-enter.
  return (
    <div className="stage-enter" key={stageKey}>
      {children}
    </div>
  );
}
