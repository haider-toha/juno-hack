// Turn stored 24-hour `HH:mm` into short spoken clock copy for chips and
// banners. English uses a 12-hour reading; French keeps 24-hour.
export function formatLocalTime(
  timeLocal: string,
  locale: "en" | "fr",
): string {
  const [hourPart, minutePart] = timeLocal.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);

  if (locale === "fr") {
    return minute === 0 ? `${hour} h` : `${hour} h ${minutePart}`;
  }

  const period = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  if (minute === 0) return `${twelve}${period}`;
  return `${twelve}:${minutePart}${period}`;
}
