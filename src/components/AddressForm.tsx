import { useEffect, useState } from "react";
import { Field } from "./Ui";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Address } from "../lib/types";
import { isValidIndianPincode } from "../lib/delivery";

export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Address;
  onSaved?: (addressId?: string) => void;
  onCancel?: () => void;
}) {
  const { saveAddress } = useStore();
  const [labelType, setLabelType] = useState<string>(() => {
    const lbl = initial?.label || "Home";
    return lbl === "Home" || lbl === "Work" ? lbl : "Other";
  });
  const [customLabel, setCustomLabel] = useState<string>(() => {
    const lbl = initial?.label || "";
    return lbl === "Home" || lbl === "Work" ? "" : lbl;
  });

  const [form, setForm] = useState({
    label: initial?.label || "Home",
    name: initial?.name || "",
    phone: initial?.phone || "",
    line1: initial?.line1 || "",
    line2: initial?.line2 || "",
    city: initial?.city || "",
    state: initial?.state || "",
    pincode: initial?.pincode || "",
    isDefault: initial?.isDefault ?? true,
  });

  useEffect(() => {
    const lbl = initial?.label || "Home";
    const isStandard = lbl === "Home" || lbl === "Work";
    setLabelType(isStandard ? lbl : "Other");
    setCustomLabel(isStandard ? "" : lbl);
    setForm({
      label: lbl,
      name: initial?.name || "",
      phone: initial?.phone || "",
      line1: initial?.line1 || "",
      line2: initial?.line2 || "",
      city: initial?.city || "",
      state: initial?.state || "",
      pincode: initial?.pincode || "",
      isDefault: initial?.isDefault ?? true,
    });
  }, [initial?.id]);

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <form
      className="address-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValidIndianPincode(form.pincode)) {
          toast("Enter a valid six-digit Indian PIN code.", "error");
          return;
        }
        const labelToSave = labelType === "Other" ? (customLabel.trim() || "Other") : form.label;
        const result = saveAddress({ ...form, label: labelToSave, id: initial?.id });
        if (result.ok) {
          toast("Address saved.", "success");
          onSaved?.(result.addressId);
        } else {
          toast(result.error, "error");
        }
      }}
    >
      <div className="field-row three">
        <Field label="Label">
          <div style={{ display: "grid", gap: "8px" }}>
            <select
              value={labelType}
              onChange={(event) => {
                const nextType = event.target.value;
                setLabelType(nextType);
                if (nextType === "Other") {
                  update("label", customLabel.trim() || "Other");
                } else {
                  update("label", nextType);
                }
              }}
            >
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </select>
            {labelType === "Other" && (
              <input
                value={customLabel}
                onChange={(event) => {
                  setCustomLabel(event.target.value);
                  update("label", event.target.value);
                }}
                placeholder="e.g. Studio, Gym"
                maxLength={30}
                required
              />
            )}
          </div>
        </Field>
        <Field label="Recipient name">
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
            autoComplete="name"
            placeholder="Full name"
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="10-digit mobile"
          />
        </Field>
      </div>
      <Field label="Address line 1">
        <input
          value={form.line1}
          onChange={(event) => update("line1", event.target.value)}
          required
          autoComplete="address-line1"
          placeholder="Flat, House no., Building, Apartment"
        />
      </Field>
      <Field label="Address line 2" hint="Optional">
        <input
          value={form.line2}
          onChange={(event) => update("line2", event.target.value)}
          autoComplete="address-line2"
          placeholder="Area, Street, Landmark"
        />
      </Field>
      <div className="field-row three">
        <Field label="City">
          <input
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            required
            placeholder="City"
          />
        </Field>
        <Field label="State">
          <input
            value={form.state}
            onChange={(event) => update("state", event.target.value)}
            required
            placeholder="State"
          />
        </Field>
        <Field label="PIN code" hint="6-digit Indian PIN">
          <input
            value={form.pincode}
            onChange={(event) => update("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            inputMode="numeric"
            autoComplete="postal-code"
            minLength={6}
            maxLength={6}
            pattern="[1-9][0-9]{5}"
            placeholder="PIN code"
          />
        </Field>
      </div>
      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(event) => update("isDefault", event.target.checked)}
        />
        Make this my default delivery address
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
