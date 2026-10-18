// Reminder times and taken doses for current medications. Times are stored as 24-hour "HH:MM".
import { UserHealthData } from '../types/medical';

export interface DoseItem {
  key: string;
  name: string;
  time: string;
  taken: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "8:00 AM" or "8 pm" -> "08:00", or null if it isn't a time
export function parseTime(text: string): string | null {
  const match = text.trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (match[3] === 'AM') hour = hour === 12 ? 0 : hour;
  else hour = hour === 12 ? 12 : hour + 12;
  return `${pad(hour)}:${pad(minute)}`;
}

// "08:00" -> "8:00 AM"
export function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map((n) => parseInt(n, 10));
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}:${pad(minute)} ${suffix}`;
}

// "2026-10-18" -> a Date at local midnight that day
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(year, month - 1, day);
}

// The day a number of days from a "2026-10-18" key, as a key
export function shiftDate(key: string, days: number): string {
  const day = dateFromKey(key);
  return dateKey(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days));
}

// 0 = Sunday ... 6 = Saturday
export const weekdayOf = (key: string) => dateFromKey(key).getDay();

export interface ScheduledMedication {
  name: string;
  times: string[];
  startDate?: string; // "YYYY-MM-DD"; no doses before this day
  lastDoseDate?: string; // "YYYY-MM-DD"; no doses after this day
  skipDays: number[]; // weekdays with no doses, 0 = Sunday ... 6 = Saturday
}

// Current medications that have reminder times
export function remindedMedications(userData: UserHealthData): ScheduledMedication[] {
  const names = [...(userData.prescriptionMedications || []), ...(userData.otcMedications || [])];
  return names
    .map((name) => {
      const active = (userData.medicationHistory || []).find((m) => m.name === name && !m.endDate);
      return {
        name,
        times: [...(active?.reminderTimes || [])].sort(),
        startDate: active?.startDate ? dateKey(new Date(active.startDate)) : undefined,
        lastDoseDate: active?.lastDoseDate,
        skipDays: [...(active?.skipDays || [])],
      };
    })
    .filter((m) => m.times.length > 0);
}

// Whether a medication is due on a day, given its start, end and skip days
export function isScheduledOn(med: Pick<ScheduledMedication, 'startDate' | 'lastDoseDate' | 'skipDays'>, date: string): boolean {
  if (med.startDate && date < med.startDate) return false;
  if (med.lastDoseDate && date > med.lastDoseDate) return false;
  return !med.skipDays.includes(weekdayOf(date));
}

export const doseKey = (date: string, name: string, time: string) => `${date}|${name}|${time}`;

// The doses scheduled for a day, in time order
export function dosesForDate(userData: UserHealthData, date: string): DoseItem[] {
  const log = userData.doseLog || {};
  return remindedMedications(userData)
    .filter((med) => isScheduledOn(med, date))
    .flatMap((med) =>
      med.times.map((time) => {
        const key = doseKey(date, med.name, time);
        return { key, name: med.name, time, taken: !!log[key] };
      })
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function dayCounts(userData: UserHealthData, date: string): { total: number; taken: number } {
  const doses = dosesForDate(userData, date);
  return { total: doses.length, taken: doses.filter((d) => d.taken).length };
}

// The next reminder for a medication: today's first time still to come, otherwise the next day it's due
export function nextDoseLabel(userData: UserHealthData, name: string, now = new Date()): string {
  const med = remindedMedications(userData).find((m) => m.name === name);
  if (!med) return '';
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const later = med.times.find((t) => {
    const [h, m] = t.split(':').map((n) => parseInt(n, 10));
    return h * 60 + m > minutesNow;
  });
  const today = dateKey(now);
  if (later && isScheduledOn(med, today)) return `next ${formatTime(later)}`;
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = shiftDate(today, ahead);
    if (!isScheduledOn(med, day)) continue;
    if (ahead === 1) return `next ${formatTime(med.times[0])} tomorrow`;
    return `next ${formatTime(med.times[0])} ${dateFromKey(day).toLocaleDateString('en-US', { weekday: 'long' })}`;
  }
  return '';
}

// The new dose log after marking a dose taken or not taken
export function toggleDoseLog(userData: UserHealthData, key: string): Record<string, string> {
  const log = { ...(userData.doseLog || {}) };
  if (log[key]) delete log[key];
  else log[key] = new Date().toISOString();
  return log;
}

// Calendar cells for a month: null for the blank days before the 1st
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let day = 1; day <= days; day++) cells.push(dateKey(new Date(year, month, day)));
  return cells;
}

// Reminder times to start with when a label says how many doses a day but not the times
export function defaultTimes(timesPerDay: number): string[] {
  switch (timesPerDay) {
    case 1:
      return ['08:00'];
    case 2:
      return ['08:00', '18:00'];
    case 3:
      return ['08:00', '13:00', '18:00'];
    case 4:
      return ['08:00', '12:00', '16:00', '20:00'];
    default:
      return [];
  }
}
