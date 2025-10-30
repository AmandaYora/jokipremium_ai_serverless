const HOLIDAY_API_ENDPOINT = "https://api-harilibur.vercel.app/api";
const monthCache = new Map();

async function fetchHolidays({ year, month }) {
  const key = `${year}-${month}`;
  if (monthCache.has(key)) {
    return monthCache.get(key);
  }

  try {
    const url = new URL(HOLIDAY_API_ENDPOINT);
    url.searchParams.set("month", String(month));
    url.searchParams.set("year", String(year));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Holiday API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Unexpected holiday API response");
    }

    monthCache.set(key, data);
    return data;
  } catch (error) {
    console.warn(`[holidayService] Failed to fetch holidays: ${error.message}`);
    monthCache.set(key, []);
    return [];
  }
}

export async function getHolidayInfoForDate(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const dateKey = date.toISOString().slice(0, 10);

  const holidays = await fetchHolidays({ year, month });
  const holiday = holidays.find((item) => item.holiday_date === dateKey);

  if (!holiday) {
    return null;
  }

  return {
    name: holiday.holiday_name,
    isNational: Boolean(holiday.is_national_holiday),
  };
}
