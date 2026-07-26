export default function Phase5Status({ value }) {
  const label = String(value || "unknown").replaceAll("_", " ");
  return <span className={`phase-five-status status-${value || "unknown"}`}>{label}</span>;
}
