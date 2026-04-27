import { Markup } from 'telegraf';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';

export function generateCalendarKeyboard(date: Date, selectedDate?: Date) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const header = weekDays.map(d => Markup.button.callback(d, 'ignore'));

  const rows: any[] = [header];
  let currentRow: any[] = [];

  const firstDayOfWeek = monthStart.getDay() || 7; // Monday = 1
  for (let i = 1; i < firstDayOfWeek; i++) {
    currentRow.push(Markup.button.callback(' ', 'ignore'));
  }

  days.forEach(day => {
    const dayOfMonth = format(day, 'd');
    const isSelected = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    const prefix = isToday(day) ? '•' : '';
    const text = `${prefix}${dayOfMonth}${isSelected ? '✓' : ''}`;
    currentRow.push(Markup.button.callback(text, `date_${format(day, 'yyyy-MM-dd')}`));

    if (currentRow.length === 7) {
      rows.push(currentRow);
      currentRow = [];
    }
  });

  while (currentRow.length < 7) {
    currentRow.push(Markup.button.callback(' ', 'ignore'));
  }
  if (currentRow.length > 0) rows.push(currentRow);

  const navRow = [
    Markup.button.callback('←', `month_${format(subMonths(date, 1), 'yyyy-MM')}`),
    Markup.button.callback(format(date, 'LLLL yyyy', { locale: ru }), 'ignore'),
    Markup.button.callback('→', `month_${format(addMonths(date, 1), 'yyyy-MM')}`)
  ];
  rows.push(navRow);

  return Markup.inlineKeyboard(rows);
}