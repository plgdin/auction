const parsePdfDateTime = (dateTimeStr: string): Date | null => {
  if (!dateTimeStr) return null;
  // Match DD-MM-YY HH:mm or DD-MM-YYYY HH:mm
  const match = dateTimeStr.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-based month
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += 2000; // assume 20xx
    }
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
  }
  return null;
};

console.log('Result 1 (15-06-26 12:00):', parsePdfDateTime('15-06-26 12:00')?.toISOString());
console.log('Result 2 (15-06-2026 12:00):', parsePdfDateTime('15-06-2026 12:00')?.toISOString());
