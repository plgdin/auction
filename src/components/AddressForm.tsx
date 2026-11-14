import { useState } from "react";
import { Field } from "./Ui";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Address } from "../lib/types";

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
  const [form, setForm] = useState({
    label: initial?.label || "Home",
    name: initial?.name || "",
    phone: initial?.phone || "",
    line1: initial?.line1 || "",
    line2: initial?.line2 || "",
    city: initial?.city || "Trivandrum",
    state: initial?.state || "Kerala",
    pincode: initial?.pincode || "",
    isDefault: initial?.isDefault ?? true,
  });

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <form
      className="address-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await saveAddress({ ...form, id: initial?.id });
        if (result.ok) {
          toast("Address saved.", "success");
          onSaved?.();
        } else {
          toast(result.error, "error");
        }
      }}
    >
      <div className="field-row three">
        <Field label="Label">
          <input value={form.label} onChange={(event) => update("label", event.target.value)} />
        </Field>
        <Field label="Recipient name">
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
            autoComplete="name"
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
      </div>
      <Field label="Address line 1">
        <input
          value={form.line1}
          onChange={(event) => update("line1", event.target.value)}
          required
          autoComplete="address-line1"
        />
      </Field>
      <Field label="Address line 2" hint="Optional">
        <input
          value={form.line2}
          onChange={(event) => update("line2", event.target.value)}
          autoComplete="address-line2"
        />
      </Field>
      <div className="field-row three">
        <Field label="City">
          <input value={form.city} onChange={(event) => update("city", event.target.value)} required />
        </Field>
        <Field label="State">
          <input value={form.state} onChange={(event) => update("state", event.target.value)} required />
        </Field>
        <Field label="Pincode" hint="Trivandrum: 695xxx">
          <input
            value={form.pincode}
            onChange={(event) => update("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            inputMode="numeric"
            autoComplete="postal-code"
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
