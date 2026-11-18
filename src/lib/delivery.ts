export function isValidIndianPincode(value: string): boolean {
  return /^[1-9]\d{5}$/.test(value.trim());
}

const pincodeCache = new Map<string, { city: string; state: string }>();

export async function lookupIndianPincode(
  value: string,
): Promise<{ city: string; state: string } | null> {
  const cleaned = value.trim();
  if (!isValidIndianPincode(cleaned)) return null;
  if (pincodeCache.has(cleaned)) return pincodeCache.get(cleaned)!;

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.Status === "Success" && data[0]?.PostOffice?.length) {
      const po = data[0].PostOffice[0];
      const result = {
        city: po.District || po.Block || po.Division || po.Name || "",
        state: po.State || "",
      };
      if (result.city && result.state) {
        pincodeCache.set(cleaned, result);
        return result;
      }
    }
  } catch (err) {
    console.warn("[Pincode lookup error]:", err);
  }
  return null;
}
