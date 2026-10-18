// Phone reminders for medication doses. Each reminder time becomes a daily notification with Taken and Snooze buttons.
// The notifications module is loaded only if this build has it, so an older build still runs (without reminders).
import { UserHealthData } from '../types/medical';
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

// Dated reminders are set this many days ahead for medications that start later or end on a set day.
const DATED_DAYS = 30;
// iOS keeps at most 64 scheduled notifications per app
const MAX_PENDING = 64;

// Replaces every reminder with the current schedule. Skip days and start and end dates are respected.
export async function scheduleReminders(userData: UserHealthData): Promise<void> {
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
