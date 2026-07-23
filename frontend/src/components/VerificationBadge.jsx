const labels = {
  unsubmitted: "KYC not submitted",
  pending: "Verification pending",
  verified: "Verified",
  rejected: "Verification rejected",
};

export default function VerificationBadge({ status = "unsubmitted" }) {
  return (
    <span className={`verification-badge ${status}`}>
      {status === "verified" ? "✓ " : ""}
      {labels[status] || labels.unsubmitted}
    </span>
  );
}
