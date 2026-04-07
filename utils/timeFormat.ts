export const formatTime = (timeInSeconds: number) => {
  if (!timeInSeconds || isNaN(timeInSeconds)) return "00:00";

  const hrs = Math.floor(timeInSeconds / 3600);
  const mins = Math.floor((timeInSeconds % 3600) / 60);
  const secs = Math.floor(timeInSeconds % 60);

  // Agar ghante (hours) 0 se zyada hain, toh format H:MM:SS hoga
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return "Unknown"; // Agar fetch na ho paye
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return (mb / 1024).toFixed(2) + " GB";
  return mb.toFixed(1) + " MB";
};

export const formatDate = (timestamp: number) => {
  if (!timestamp) return "Unknown Date";
  // 🔥 FIX: Agar OS ne milliseconds ki jagah seconds return kiye hain, toh usko 1000 se multiply kardo
  const finalTimestamp = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const date = new Date(finalTimestamp);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
