export function formatDisplayDate(
  date: Date | string | undefined | null,
): string {
  const dateObj = parseDate(date);

  const datePart = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timePart = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart} at ${timePart}`;
}

function parseDate(date: Date | string | undefined | null): Date {
  if (!date) {
    return new Date();
  }

  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  return date;
}
