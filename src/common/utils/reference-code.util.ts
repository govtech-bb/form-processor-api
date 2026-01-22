/**
 * Generates a human-friendly reference code in the format: PREFIX-YYYYMMDD-XXXXXX
 * Example: GDC-20260122-A3B7K9
 *
 * @param formId - The form ID (e.g., "get-death-certificate")
 * @returns A human-friendly reference code
 */
export function generateReferenceCode(formId: string, length = 6): string {
  const prefix = generatePrefix(formId);
  const dateStr = formatDate(new Date());
  const timeStr = formatTime(new Date());
  const randomPart = generateRandomString(length);

  return `${prefix}-${dateStr}-${timeStr}-${randomPart}`;
}

/**
 * Generates a prefix from the form ID by taking the first letter of each word
 * Example: "get-death-certificate" => "GDC"
 */
function generatePrefix(formId: string): string {
  return formId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Formats a time as HHMMSS
 */
function formatTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return `${pad(date.getHours())}${pad(date.getMinutes())}${pad(
    date.getSeconds(),
  )}`;
}

/**
 * Formats a date as YYYYMMDD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generates a random alphanumeric string of the specified length
 * Uses uppercase letters and digits for readability
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded I, O, 0, 1 to avoid confusion
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
