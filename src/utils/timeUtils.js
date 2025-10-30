const ID_LOCALE = "id-ID";

function formatDateLabel(date) {
  return new Intl.DateTimeFormat(ID_LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function determinePartOfDay(hour) {
  if (hour >= 4 && hour < 11) return "pagi";
  if (hour >= 11 && hour < 15) return "siang";
  if (hour >= 15 && hour < 19) return "sore";
  return "malam";
}

export function getTimeContext(date = new Date()) {
  const partOfDay = determinePartOfDay(date.getHours());
  const greeting = `Selamat ${partOfDay}`;
  const dateLabel = formatDateLabel(date);

  return {
    partOfDay,
    greeting,
    dateLabel,
    isoDate: date.toISOString().slice(0, 10),
  };
}
