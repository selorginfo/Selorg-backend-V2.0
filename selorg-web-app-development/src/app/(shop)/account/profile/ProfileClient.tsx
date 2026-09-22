"use client";

import { Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ProfileClient() {
  const {
    profile,
    profileEditing,
    profileDraft,
    profileError,
    phoneLocked,
    startEditProfile,
    cancelEditProfile,
    setProfileField,
    saveProfile,
  } = useAuth();

  if (!profileEditing) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Personal information</h2>
          <Button variant="secondary" size="sm" onClick={startEditProfile}>
            <Pencil size={13} /> Edit
          </Button>
        </div>
        <div className="flex flex-col divide-y divide-line">
          <Field label="Full name" value={profile.name} />
          <Field label="Email address" value={profile.email} />
          <Field
            label="Mobile number"
            value={
              <span className="flex items-center gap-2">
                {profile.phone}
                <span className="rounded-[20px] bg-accent-tint px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide text-accent-dark">
                  VERIFIED
                </span>
              </span>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-extrabold">Personal information</h2>
      <div className="flex flex-col gap-3.5">
        <Input label="Full name" value={profileDraft.name} onChange={(e) => setProfileField("name", e.target.value)} />
        <Input
          label="Email address"
          value={profileDraft.email}
          onChange={(e) => setProfileField("email", e.target.value)}
        />
        <div>
          <Input
            label="Mobile number"
            inputMode="tel"
            value={profileDraft.phone}
            readOnly={phoneLocked}
            disabled={phoneLocked}
            onChange={(e) => setProfileField("phone", e.target.value)}
          />
          <div className="mt-1.5 text-[11.5px] text-muted">
            {phoneLocked
              ? "Your verified mobile number can't be changed here. Contact support to update it."
              : "Changing this needs a one-time verification on the new number."}
          </div>
        </div>
        {profileError ? <p className="text-xs font-semibold text-warn">{profileError}</p> : null}
        <div className="mt-2 flex gap-3">
          <Button variant="outline" onClick={cancelEditProfile} className="flex-1">
            Cancel
          </Button>
          <Button onClick={saveProfile} className="flex-1">
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
