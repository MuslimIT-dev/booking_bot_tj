import { Markup } from 'telegraf';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
  parse,
  set,
} from 'date-fns';
import { ru } from 'date-fns/locale';

export function getCalendar(monthStr: string) {
  const date = parse(monthStr, 'yyyy-MM', new Date());
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const rows: any[] = [
    [...['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => Markup.button.callback(d, 'ignore'))],
  ];
  let currentRow: any[] = [];

  const firstDay = monthStart.getDay() || 7;
  for (let i = 1; i < firstDay; i++) currentRow.push(Markup.button.callback(' ', 'ignore'));

  days.forEach((day) => {
    const text = isToday(day) ? `•${format(day, 'd')}•` : format(day, 'd');
    currentRow.push(Markup.button.callback(text, `date_${format(day, 'yyyy-MM-dd')}`));
    if (currentRow.length === 7) {
      rows.push(currentRow);
      currentRow = [];
    }
  });

  while (currentRow.length < 7 && currentRow.length > 0)
    currentRow.push(Markup.button.callback(' ', 'ignore'));
  if (currentRow.length > 0) rows.push(currentRow);

  rows.push([
    Markup.button.callback('⬅️', `month_${format(subMonths(date, 1), 'yyyy-MM')}`),
    Markup.button.callback(format(date, 'LLLL yyyy', { locale: ru }), 'ignore'),
    Markup.button.callback('➡️', `month_${format(addMonths(date, 1), 'yyyy-MM')}`),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function parseDateStr(dateStr: string): Date {
  return parse(dateStr, 'yyyy-MM-dd', new Date());
}

export function setTimeOnDate(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return set(date, { hours, minutes, seconds: 0, milliseconds: 0 });
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}