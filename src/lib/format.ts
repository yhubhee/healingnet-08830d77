export function formatNaira(amount: number): string {
  const n = Number(amount) || 0;
  if (n >= 1000000) return "₦" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "₦" + (n / 1000).toFixed(0) + "K";
  return "₦" + n.toLocaleString();
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function getInitials(first?: string, last?: string): string {
  return ((first || "")[0] || "") + ((last || "")[0] || "");
}

export function statusLabel(status: string): string {
  return (status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
