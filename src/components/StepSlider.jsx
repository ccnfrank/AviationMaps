import { Minus, Plus, RotateCcw } from "lucide-react";

// Ajuste com − slider + valor e restaurar. Usado pelo zoom e pelo brilho, para que os dois
// se comportem igual. `precision` arredonda o valor (casas decimais) e vale para os botões e o slider.
export default function StepSlider({
  label, decLabel, incLabel, resetLabel, value, min, max, step, buttonStep, defaultValue, precision = 0, format, onChange, leading,
}) {
  const set = (next) => onChange(Number(Math.min(max, Math.max(min, next)).toFixed(precision)));
  const fill = `${((value - min) / (max - min)) * 100}%`;

  return (
    <div className="tool-group" role="group" aria-label={label}>
      {leading}
      <button type="button" className="tool-step" onClick={() => set(value - buttonStep)} disabled={value <= min} aria-label={decLabel}>
        <Minus strokeWidth={2} aria-hidden="true" />
      </button>
      <input
        type="range"
        className="tool-range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": fill }}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={format(value)}
      />
      <button type="button" className="tool-step" onClick={() => set(value + buttonStep)} disabled={value >= max} aria-label={incLabel}>
        <Plus strokeWidth={2} aria-hidden="true" />
      </button>
      {/* A chave muda a cada valor: o número pisca de leve, dando retorno ao arrastar. */}
      <output key={format(value)} className="tool-value" aria-live="off">{format(value)}</output>
      {resetLabel && (
        <button
          type="button"
          className="tool-reset"
          onClick={() => set(defaultValue)}
          disabled={value === defaultValue}
          aria-label={resetLabel}
          title={resetLabel}
        >
          <RotateCcw strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
