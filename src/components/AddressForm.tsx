import { useState } from "react";
import { Field } from "./Ui";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Address } from "../lib/types";
import { isValidIndianPincode, lookupIndianPincode } from "../lib/delivery";
import { Check, Loader2 } from "lucide-react";

export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Address;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { saveAddress } = useStore();

  const initialLabelType =
    initial?.label === "Home" || initial?.label === "Work"
      ? initial.label
      : initial?.label
        ? "Other"
        : "Home";

  const [labelType, setLabelType] = useState<"Home" | "Work" | "Other">(initialLabelType);
  const [customLabel, setCustomLabel] = useState(
    initialLabelType === "Other" ? initial?.label || "" : "",
  );

  const [form, setForm] = useState({
    name: initial?.name || "",
    phone: initial?.phone || "",
    line1: initial?.line1 || "",
    line2: initial?.line2 || "",
    city: initial?.city || "",
    state: initial?.state || "",
    pincode: initial?.pincode || "",
    isDefault: initial?.isDefault ?? true,
  });

  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeFound, setPincodeFound] = useState<string | null>(null);

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const handlePhoneChange = (val: string) => {
    // Strip leading +91 or 91 (if 12 digits) or leading 0 (if 11 digits) from autofill
    let cleaned = val.trim();
    if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
    cleaned = cleaned.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("91")) cleaned = cleaned.slice(2);
    else if (cleaned.length === 11 && cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    const digits = cleaned.slice(0, 10);
    update("phone", digits);
  };

  const handlePincodeChange = async (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    update("pincode", digits);
    setPincodeFound(null);

    if (digits.length === 6 && isValidIndianPincode(digits)) {
      setPincodeLoading(true);
      try {
        const place = await lookupIndianPincode(digits);
        if (place) {
          setForm((prev) => ({
            ...prev,
            pincode: digits,
            city: prev.city || place.city,
            state: prev.state || place.state,
          }));
          setPincodeFound(`${place.city}, ${place.state}`);
          toast(`Area found: ${place.city}, ${place.state}`, "success");
        }
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = form.name.trim();
    if (trimmedName.length < 2) {
      toast("Enter a valid recipient name (minimum 2 letters).", "error");
      return;
    }

    const trimmedPhone = form.phone.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      toast("Enter a valid 10-digit Indian phone number starting with 6-9.", "error");
      return;
    }

    const trimmedLine1 = form.line1.trim();
    if (trimmedLine1.length < 5) {
      toast("Enter complete address in line 1 (house/flat and street).", "error");
      return;
    }

    if (!isValidIndianPincode(form.pincode)) {
      toast("Enter a valid six-digit Indian PIN code.", "error");
      return;
    }

    if (!form.city.trim()) {
      toast("City is required.", "error");
      return;
    }

    if (!form.state.trim()) {
      toast("State is required.", "error");
      return;
    }

    const finalLabel =
      labelType === "Other"
        ? customLabel.trim() || "Other"
        : labelType;

    const result = saveAddress({
      ...form,
      name: trimmedName,
      phone: trimmedPhone,
      line1: trimmedLine1,
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      label: finalLabel,
      id: initial?.id,
    });

    if (result.ok) {
      toast("Address saved.", "success");
      onSaved?.();
    } else {
      toast(result.error, "error");
    }
  };

  return (
    <form className="address-form" onSubmit={handleSubmit}>
      <div className="field-row three">
        <Field label="Label">
          <select
            value={labelType}
            onChange={(event) =>
              setLabelType(event.target.value as "Home" | "Work" | "Other")
            }
          >
            <option value="Home">Home</option>
            <option value="Work">Work</option>
            <option value="Other">Other</option>
          </select>
        </Field>

        <Field label="Recipient name">
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
            autoComplete="name"
            placeholder="e.g. Rahul Sharma"
          />
        </Field>

        <Field label="Phone (10 digits)">
          <input
            value={form.phone}
            onChange={(event) => handlePhoneChange(event.target.value)}
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            placeholder="e.g. 9876543210"
          />
        </Field>
      </div>

      {labelType === "Other" && (
        <Field label="Custom label name">
          <input
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            required
            placeholder="e.g. Studio, Hostel, Vacation Home"
            autoFocus
          />
        </Field>
      )}

      <Field label="Address line 1">
        <input
          value={form.line1}
          onChange={(event) => update("line1", event.target.value)}
          required
          autoComplete="address-line1"
          placeholder="House / Flat / Building no, Street, Area"
        />
      </Field>

      <Field label="Address line 2 (Optional)">
        <input
          value={form.line2}
          onChange={(event) => update("line2", event.target.value)}
          autoComplete="address-line2"
          placeholder="Apartment, suite, landmark, floor (optional)"
        />
      </Field>

      <div className="field-row three">
        <Field label="PIN code">
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              value={form.pincode}
              onChange={(event) => handlePincodeChange(event.target.value)}
              required
              inputMode="numeric"
              autoComplete="postal-code"
              minLength={6}
              maxLength={6}
              pattern="[1-9][0-9]{5}"
              placeholder="e.g. 695615"
              style={{ width: "100%", paddingRight: pincodeLoading ? 32 : 12 }}
            />
            {pincodeLoading && (
              <span
                style={{
                  position: "absolute",
                  right: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <Loader2 size={15} className="animate-spin" style={{ color: "#7A6854" }} />
              </span>
            )}
          </div>
        </Field>

        <Field label="City / District">
          <input
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            required
            placeholder={pincodeLoading ? "Looking up…" : "City"}
          />
        </Field>

        <Field label="State">
          <input
            value={form.state}
            onChange={(event) => update("state", event.target.value)}
            required
            placeholder={pincodeLoading ? "Looking up…" : "State"}
          />
        </Field>
      </div>

      {pincodeFound && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#4A5438",
            marginTop: -6,
            marginBottom: 2,
            width: "fit-content",
          }}
        >
          <Check size={14} /> Auto-filled from PIN: <strong>{pincodeFound}</strong>
        </div>
      )}

      <label
        className="checkbox-line"
        style={{ width: "fit-content", maxWidth: "max-content", cursor: "pointer" }}
      >
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(event) => update("isDefault", event.target.checked)}
        />
        <span>Make this my default delivery address</span>
      </label>

      <div className="modal-actions">
        <button type="submit" className="button button-olive">
          Save address
        </button>
        {onCancel && (
          <button type="button" className="button button-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
