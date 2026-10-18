// Phone reminders for medication doses and upcoming appointments. Each dose time becomes a notification with Taken and Snooze buttons.
// The notifications module is loaded only if this build has it, so an older build still runs (without reminders).
import { UserHealthData } from '../types/medical';
import type { Appointment } from './ehrService';
import { dateKey, formatTime, isScheduledOn, remindedMedications, shiftDate } from './doseSchedule';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

export const remindersAvailable = () => !!Notifications;

const CATEGORY = 'MEDICATION_DOSE';
export const SNOOZE_MINUTES = 15;

// Sets how reminders look and which buttons they have. Call once when the app starts.
export function setupReminders(): void {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'TAKEN', buttonTitle: 'Taken', options: { opensAppToForeground: false } },
    { identifier: 'SNOOZE', buttonTitle: `Snooze ${SNOOZE_MINUTES} min`, options: { opensAppToForeground: false } },
  ]).catch(() => {});
}

// Asks for permission the first time it's needed. Returns true if reminders can be sent.
export async function requestReminderPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Reads an appointment such as "August 15, 2024 • 2:00 PM" or "August 15, 2024 • 14:00". The time is optional.
export function appointmentMoment(dateTime: string): { at: Date; hasTime: boolean } | null {
  const date = dateTime.match(/([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (!date) return null;
  const month = MONTH_NAMES.findIndex((name) => name.startsWith(date[1].toLowerCase().slice(0, 3)));
  if (month < 0) return null;
  const day = parseInt(date[2], 10);
  const year = parseInt(date[3], 10);
  const rest = dateTime.slice((date.index ?? 0) + date[0].length);

  const withPeriod = rest.match(/(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]\b/);
  if (withPeriod) {
    let hour = parseInt(withPeriod[1], 10) % 12;
    if (withPeriod[3].toLowerCase() === 'p') hour += 12;
    return { at: new Date(year, month, day, hour, parseInt(withPeriod[2] || '0', 10)), hasTime: true };
  }
  const twentyFourHour = rest.match(/\b(\d{1,2}):(\d{2})\b/);
  if (twentyFourHour) {
    return { at: new Date(year, month, day, parseInt(twentyFourHour[1], 10), parseInt(twentyFourHour[2], 10)), hasTime: true };
  }
  return { at: new Date(year, month, day, 9, 0), hasTime: false };
}

// Dated reminders are set this many days ahead for medications that start later or end on a set day.
const DATED_DAYS = 30;
// iOS keeps at most 64 scheduled notifications per app
const MAX_PENDING = 64;

// Replaces every reminder with the current schedule. Skip days, start and end dates, and appointments are included.
export async function scheduleReminders(userData: UserHealthData, epicAppointments: Appointment[] = []): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  const today = dateKey(now);
  const repeating: { content: object; trigger: object }[] = [];
  const dated: { at: Date; content: object }[] = [];

  for (const med of remindedMedications(userData)) {
    if (med.lastDoseDate && med.lastDoseDate < today) continue;
    const content = (time: string) => ({
      title: 'Time for your medication',
      body: `${med.name} at ${formatTime(time)}`,
      categoryIdentifier: CATEGORY,
      data: { kind: 'dose', name: med.name, time },
    });

    if ((med.startDate && med.startDate > today) || med.lastDoseDate) {
      // One reminder per day, so the start and end dates are exact
      const first = med.startDate && med.startDate > today ? med.startDate : today;
      const last = med.lastDoseDate || shiftDate(today, DATED_DAYS);
      for (let day = first; day <= last; day = shiftDate(day, 1)) {
        if (!isScheduledOn(med, day)) continue;
        for (const time of med.times) {
          const [year, month, date] = day.split('-').map((n) => parseInt(n, 10));
          const [hour, minute] = time.split(':').map((n) => parseInt(n, 10));
          const at = new Date(year, month - 1, date, hour, minute);
          if (at > now) dated.push({ at, content: content(time) });
        }
      }
    } else {
      // Repeats every day, or every week on the days that aren't skipped
      for (const time of med.times) {
        const [hour, minute] = time.split(':').map((n) => parseInt(n, 10));
        if (med.skipDays.length === 0) {
          repeating.push({ content: content(time), trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute } });
          continue;
        }
        for (let weekday = 0; weekday < 7; weekday++) {
          if (med.skipDays.includes(weekday)) continue;
          // Expo counts weekdays from 1 for Sunday
          repeating.push({ content: content(time), trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: weekday + 1, hour, minute } });
        }
      }
    }
  }

  // Appointments you added and appointments from Epic: the day before at 9:00 AM, and an hour before when the time is known
  const appointments: { at: Date; hasTime: boolean; subject: string; who: string }[] = [];
  for (const appointment of userData.appointments || []) {
    const moment = appointmentMoment(appointment.dateTime);
    if (!moment) continue;
    appointments.push({
      ...moment,
      subject: appointment.specialty ? `${appointment.specialty} appointment` : 'Appointment',
      who: appointment.doctorName ? ` with ${appointment.doctorName}` : '',
    });
  }
  for (const appointment of epicAppointments) {
    if (!appointment.start) continue;
    appointments.push({
      at: new Date(appointment.start),
      hasTime: true,
      subject: appointment.description || 'Appointment',
      who: appointment.provider && appointment.provider !== 'Unknown Provider' ? ` with ${appointment.provider}` : '',
    });
  }
  // off: none; day: the day before; standard: the day before and an hour before; frequent: also a week before
  const level = userData.appointmentReminders ?? 'standard';
  for (const appointment of level === 'off' ? [] : appointments) {
    const timeLabel = appointment.hasTime
      ? ` at ${appointment.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : '';
    const content = (body: string) => ({
      title: 'Upcoming appointment',
      body: `${appointment.subject}${appointment.who} ${body}`,
      data: { kind: 'appointment' },
    });
    const morningBefore = (days: number) => {
      const when = new Date(appointment.at);
      when.setDate(when.getDate() - days);
      when.setHours(9, 0, 0, 0);
      return when;
    };

    if (level === 'frequent') {
      const dayLabel = appointment.at.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const weekBefore = morningBefore(7);
      if (weekBefore > now) dated.push({ at: weekBefore, content: content(`on ${dayLabel}${timeLabel}`) });
    }

    const dayBefore = morningBefore(1);
    if (dayBefore > now) dated.push({ at: dayBefore, content: content(`tomorrow${timeLabel}`) });

    if (appointment.hasTime && level !== 'day') {
      const hourBefore = new Date(appointment.at.getTime() - 60 * 60 * 1000);
      if (hourBefore > now) dated.push({ at: hourBefore, content: content('in 1 hour') });
    }
  }

  // Repeating reminders come first; dated ones fill whatever room is left
  if (repeating.length > MAX_PENDING) console.warn(`Only ${MAX_PENDING} reminders fit on the phone; ${repeating.length} were needed`);
  for (const reminder of repeating.slice(0, MAX_PENDING)) {
    await Notifications.scheduleNotificationAsync(reminder);
  }
  dated.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const reminder of dated.slice(0, Math.max(0, MAX_PENDING - repeating.length))) {
    await Notifications.scheduleNotificationAsync({
      content: reminder.content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
    });
  }
}

// Calls onTaken when someone taps Taken on a reminder. Tapping Snooze schedules the same reminder again later.
// Returns a function that stops listening.
export function listenForReminderResponses(onTaken: (name: string, time: string) => void): () => void {
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification?.request?.content?.data || {};
    if (data.kind !== 'dose') return;
    if (response.actionIdentifier === 'TAKEN') {
      onTaken(data.name, data.time);
    } else if (response.actionIdentifier === 'SNOOZE') {
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time for your medication',
          body: `${data.name} at ${formatTime(data.time)}`,
          categoryIdentifier: CATEGORY,
          data,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SNOOZE_MINUTES * 60, repeats: false },
      });
    }
  });
  return () => subscription.remove();
}
