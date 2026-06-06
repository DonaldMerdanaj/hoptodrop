"use client";

import { useEffect, useState } from "react";
import { ensureUserProfile } from "@/lib/authProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DriverForm = {
  full_name: string;
  phone: string;
  city: string;
  national_id: string;
  license_number: string;
  license_expires_at: string;
  taxi_license_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  license_plate: string;
  vehicle_color: string;
  seats: string;
  iban: string;
  driver_license_url: string;
  vehicle_registration_url: string;
  insurance_url: string;
  profile_photo_url: string;
};

const emptyForm: DriverForm = {
  full_name: "",
  phone: "",
  city: "Tirana",
  national_id: "",
  license_number: "",
  license_expires_at: "",
  taxi_license_number: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_year: "",
  license_plate: "",
  vehicle_color: "",
  seats: "4",
  iban: "",
  driver_license_url: "",
  vehicle_registration_url: "",
  insurance_url: "",
  profile_photo_url: ""
};

export default function DriverRegistrationForm() {
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [files, setFiles] = useState<Partial<Record<"profile_photo_url" | "driver_license_url" | "vehicle_registration_url" | "insurance_url", File>>>({});
  const [status, setStatus] = useState("draft");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!isSupabaseConfigured || !supabase) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase.from("driver_profiles").select("*").eq("id", userData.user.id).maybeSingle();
      if (data) {
        setForm({
          ...emptyForm,
          ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value ?? ""])),
          seats: String(data.seats || 4)
        } as DriverForm);
        setStatus(data.approval_status || "draft");
      }
    }

    loadProfile();
  }, []);

  function updateField(key: keyof DriverForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitRegistration(event: React.FormEvent) {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required. Add your Supabase project URL and anon key to .env.local.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setMessage("Create or login to a driver account first.");
      return;
    }

    await ensureUserProfile(user, "driver");

    const uploaded = { ...form };
    for (const [field, file] of Object.entries(files)) {
      if (!file) continue;
      const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${user.id}/${field}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setMessage(`Could not upload ${file.name}: ${uploadError.message}`);
        return;
      }
      uploaded[field as keyof DriverForm] = path;
    }

    const payload = {
      id: user.id,
      email: user.email,
      ...uploaded,
      vehicle_year: Number(form.vehicle_year || 0),
      seats: Number(form.seats || 4),
      approval_status: status === "approved" ? "approved" : "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("driver_profiles").upsert(payload);
    if (error) setMessage(error.message);
    else {
      const nextStatus = status === "approved" ? "approved" : "submitted";
      setStatus(nextStatus);
      setMessage(nextStatus === "approved" ? "Driver profile updated." : "Registration submitted. Dispatch will review and approve your account.");
    }
  }

  return (
    <form className="driver-registration" onSubmit={submitRegistration}>
      <div className={`driver-status ${status}`}>
        <strong>Onboarding status</strong>
        <span>{status}</span>
      </div>

      <div className="form-section">
        <h2>Driver details</h2>
        <label><span>Full name</span><input value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} required /></label>
        <label><span>Phone</span><input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} required /></label>
        <label><span>City</span><select value={form.city} onChange={(e) => updateField("city", e.target.value)}><option>Tirana</option><option>Vlora</option><option>Durres</option><option>Shkoder</option><option>Sarande</option><option>Elbasan</option></select></label>
        <label><span>National ID / passport</span><input value={form.national_id} onChange={(e) => updateField("national_id", e.target.value)} required /></label>
      </div>

      <div className="form-section">
        <h2>Licenses</h2>
        <label><span>Driver license number</span><input value={form.license_number} onChange={(e) => updateField("license_number", e.target.value)} required /></label>
        <label><span>License expiry</span><input type="date" value={form.license_expires_at} onChange={(e) => updateField("license_expires_at", e.target.value)} required /></label>
        <label><span>Taxi / transport license number</span><input value={form.taxi_license_number} onChange={(e) => updateField("taxi_license_number", e.target.value)} required /></label>
      </div>

      <div className="form-section">
        <h2>Vehicle</h2>
        <div className="quick-grid">
          <label><span>Make</span><input value={form.vehicle_make} onChange={(e) => updateField("vehicle_make", e.target.value)} required /></label>
          <label><span>Model</span><input value={form.vehicle_model} onChange={(e) => updateField("vehicle_model", e.target.value)} required /></label>
          <label><span>Year</span><input type="number" min={2000} value={form.vehicle_year} onChange={(e) => updateField("vehicle_year", e.target.value)} required /></label>
          <label><span>Plate</span><input value={form.license_plate} onChange={(e) => updateField("license_plate", e.target.value.toUpperCase())} required /></label>
          <label><span>Color</span><input value={form.vehicle_color} onChange={(e) => updateField("vehicle_color", e.target.value)} required /></label>
          <label><span>Seats</span><input type="number" min={1} max={8} value={form.seats} onChange={(e) => updateField("seats", e.target.value)} required /></label>
        </div>
      </div>

      <div className="form-section">
        <h2>Documents</h2>
        <label><span>Profile photo</span><input type="file" accept="image/*" onChange={(e) => setFiles((current) => ({ ...current, profile_photo_url: e.target.files?.[0] }))} /></label>
        <label><span>Driver license document</span><input type="file" accept="image/*,.pdf" required={!form.driver_license_url} onChange={(e) => setFiles((current) => ({ ...current, driver_license_url: e.target.files?.[0] }))} /></label>
        <label><span>Vehicle registration document</span><input type="file" accept="image/*,.pdf" required={!form.vehicle_registration_url} onChange={(e) => setFiles((current) => ({ ...current, vehicle_registration_url: e.target.files?.[0] }))} /></label>
        <label><span>Insurance document</span><input type="file" accept="image/*,.pdf" required={!form.insurance_url} onChange={(e) => setFiles((current) => ({ ...current, insurance_url: e.target.files?.[0] }))} /></label>
      </div>

      <div className="form-section">
        <h2>Payout</h2>
        <label><span>IBAN</span><input value={form.iban} onChange={(e) => updateField("iban", e.target.value.toUpperCase())} required /></label>
      </div>

      <button className="primary-btn" type="submit">{status === "approved" ? "Update driver profile" : "Submit driver registration"}</button>
      {message && <p className="status-message">{message}</p>}
    </form>
  );
}
