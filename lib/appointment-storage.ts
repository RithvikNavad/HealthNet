export type HealthNetAppointment = {
  id: string;
  title: string;
  visitType: string;
  date: string;
  time: string;
  clinician: string;
  location: string;
  reason: string;
  goal: string;
  concerns: string;
  questions: string;
  notes: string;
  status: "scheduled" | "completed";
  createdAt: string;
  updatedAt: string;
};

export const APPOINTMENTS_KEY = "healthnet-device-appointments";

export function loadAppointments(): HealthNetAppointment[] {
  try {
    const value = window.localStorage.getItem(APPOINTMENTS_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as HealthNetAppointment[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.date && item?.title) : [];
  } catch {
    return [];
  }
}

export function persistAppointments(appointments: HealthNetAppointment[]) {
  window.localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
}

export function appointmentTimestamp(appointment: HealthNetAppointment) {
  const time = appointment.time || "23:59";
  return new Date(`${appointment.date}T${time}:00`).getTime();
}
