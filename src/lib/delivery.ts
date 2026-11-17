export function isValidIndianPincode(value: string): boolean {
  return /^[1-9]\d{5}$/.test(value);
}
