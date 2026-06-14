import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PatientPicker } from "./PatientPicker";
import { RichTextEditor } from "./RichTextEditor";

interface DynamicEMRFormProps {
  entryType: string;
  patientId: string;
  onPatientChange: (patientId: string) => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export function DynamicEMRForm({ entryType, patientId, onPatientChange, onSubmit, isLoading }: DynamicEMRFormProps) {
  const [form, setForm] = useState<any>({
    title: "",
    content: "",
    entry_type: entryType,
    patient_id: patientId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, patient_id: patientId });
  };

  if (entryType === "vitals") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <PatientPicker value={patientId} onChange={onPatientChange} />

        <div>
          <Label>Blood Pressure (mmHg)</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Systolic"
                type="number"
                value={form.systolic || ""}
                onChange={(e) => setForm({ ...form, systolic: e.target.value })}
              />
            </div>
            <span className="flex items-center">/</span>
            <div className="flex-1">
              <Input
                placeholder="Diastolic"
                type="number"
                value={form.diastolic || ""}
                onChange={(e) => setForm({ ...form, diastolic: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Heart Rate (bpm)</Label>
            <Input
              type="number"
              placeholder="e.g., 72"
              value={form.heart_rate || ""}
              onChange={(e) => setForm({ ...form, heart_rate: e.target.value })}
            />
          </div>
          <div>
            <Label>Temperature (°C)</Label>
            <Input
              type="number"
              placeholder="e.g., 36.5"
              step="0.1"
              value={form.temperature || ""}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>O₂ Saturation (%)</Label>
            <Input
              type="number"
              placeholder="e.g., 98"
              value={form.oxygen_saturation || ""}
              onChange={(e) => setForm({ ...form, oxygen_saturation: e.target.value })}
            />
          </div>
          <div>
            <Label>Respiratory Rate (breaths/min)</Label>
            <Input
              type="number"
              placeholder="e.g., 16"
              value={form.respiratory_rate || ""}
              onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Blood Glucose (mg/dL)</Label>
            <Input
              type="number"
              placeholder="e.g., 100"
              value={form.blood_glucose || ""}
              onChange={(e) => setForm({ ...form, blood_glucose: e.target.value })}
            />
          </div>
          <div>
            <Label>Weight (kg)</Label>
            <Input
              type="number"
              placeholder="e.g., 70"
              step="0.1"
              value={form.weight || ""}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <RichTextEditor
            value={form.content || ""}
            onChange={(v) => setForm({ ...form, content: v })}
            placeholder="Add notes, observations, or clinical findings..."
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Vitals"}
        </Button>
      </form>
    );
  }

  // Default form for other types
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PatientPicker value={patientId} onChange={onPatientChange} />
      <div>
        <Label>Title</Label>
        <Input
          required
          value={form.title || ""}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g., Patient Assessment"
        />
      </div>
      <div>
        <Label>Content / Notes</Label>
        <RichTextEditor
          value={form.content || ""}
          onChange={(v) => setForm({ ...form, content: v })}
          placeholder="Enter detailed notes with formatting..."
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Entry"}
      </Button>
    </form>
  );
}
