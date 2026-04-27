import { Scenes, Composer, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

const daysOfWeek = [
  { id: 1, name: 'Пн' }, { id: 2, name: 'Вт' }, { id: 3, name: 'Ср' },
  { id: 4, name: 'Чт' }, { id: 5, name: 'Пт' }, { id: 6, name: 'Сб' }, { id: 7, name: 'Вс' }
];

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

async function renderDaysKeyboard(ctx: MyContext) {
  const selected = ctx.scene.session.selectedDays || [];
  const buttons = daysOfWeek.map(d =>
    Markup.button.callback(`${selected.includes(d.id) ? '✅' : '⬜️'} ${d.name}`, `toggle_day_${d.id}`)
  );

  const kb = [buttons.slice(0, 4), buttons.slice(4)];
  if (selected.length > 0) kb.push([Markup.button.callback('➡️ Продолжить', 'next_step')]);

  const text = 'Выберите дни недели для применения расписания (можно несколько):';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, Markup.inlineKeyboard(kb));
  } else {
    await ctx.reply(text, Markup.inlineKeyboard(kb));
  }
}

const step1 = new Composer<MyContext>();
step1.action(/^emp_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.session.employeeId = Number(ctx.match[1]);
  ctx.scene.session.selectedDays = [];

  await renderDaysKeyboard(ctx);
  return ctx.wizard.next();
});

const step2 = new Composer<MyContext>();
step2.action(/^toggle_day_(\d+)$/, async (ctx) => {
  const dayId = Number(ctx.match[1]);
  const session = ctx.scene.session;

  if (!session.selectedDays) session.selectedDays = [];

  if (session.selectedDays.includes(dayId)) {
    session.selectedDays = session.selectedDays.filter((id: number) => id !== dayId);
  } else {
    session.selectedDays.push(dayId);
  }
  await renderDaysKeyboard(ctx);
  await ctx.answerCbQuery();
});

step2.action('next_step', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Введите время работы в формате **ЧЧ:ММ - ЧЧ:ММ**\nПример: `09:00 - 18:00`', { parse_mode: 'Markdown' });
  return ctx.wizard.next();
});

const step3 = new Composer<MyContext>();
step3.on('text', async (ctx) => {
  const parts = ctx.message.text.split('-').map(s => s.trim());
  if (parts.length !== 2 || !timeRegex.test(parts[0]) || !timeRegex.test(parts[1]) || parts[0] >= parts[1]) {
    return ctx.reply('❌ Неверный формат или логика. Введите время как `09:00 - 18:00`', { parse_mode: 'Markdown' });
  }

  ctx.scene.session.startTime = parts[0];
  ctx.scene.session.endTime = parts[1];

  await ctx.reply(
    'Введите время обеда в формате **ЧЧ:ММ - ЧЧ:ММ** (Пример: `13:00 - 14:00`)\n\nИли нажмите кнопку ниже, если обеда нет.',
    Markup.inlineKeyboard([[Markup.button.callback('Без обеда', 'no_break')]])
  );
  return ctx.wizard.next();
});

const step4 = new Composer<MyContext>();

async function saveSchedule(ctx: MyContext, breakStart?: string, breakEnd?: string) {
  const session = ctx.scene.session;
  try {
    await adminService.setMassWorkSchedule(
      ctx.botId,
      session.employeeId!,
      session.selectedDays!,
      session.startTime!,
      session.endTime!,
      breakStart,
      breakEnd
    );
    await ctx.reply('✅ Расписание успешно применено ко всем выбранным дням!');
  } catch (e) {
    console.error(e);
    await ctx.reply('❌ Ошибка сохранения БД.');
  }
  return ctx.scene.enter('admin_menu');
}

step4.action('no_break', async (ctx) => {
  await ctx.answerCbQuery();
  await saveSchedule(ctx);
});

step4.on('text', async (ctx) => {
  const parts = ctx.message.text.split('-').map(s => s.trim());
  const session = ctx.scene.session;

  if (parts.length !== 2 || !timeRegex.test(parts[0]) || !timeRegex.test(parts[1]) || parts[0] >= parts[1]) {
    return ctx.reply('❌ Неверный формат. Введите как `13:00 - 14:00` или нажмите "Без обеда".');
  }

  if (parts[0] <= session.startTime! || parts[1] >= session.endTime!) {
    return ctx.reply('❌ Обед должен быть внутри рабочего времени!');
  }

  await saveSchedule(ctx, parts[0], parts[1]);
});

export const addScheduleWizard = new Scenes.WizardScene<MyContext>(
  'add_schedule_wizard',
  async (ctx) => {
    const employees = await adminService.getAllEmployees(ctx.botId);
    if (employees.length === 0) {
      await ctx.reply('Сначала добавьте сотрудников.');
      return ctx.scene.enter('admin_menu');
    }
    const buttons = employees.map(e => [Markup.button.callback(e.name, `emp_${e.id}`)]);
    buttons.push([Markup.button.callback('Отмена', 'cancel')]);

    await ctx.reply('Выберите сотрудника:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },
  step1,
  step2,
  step3,
  step4
);

addScheduleWizard.action('cancel', (ctx) => ctx.scene.enter('admin_menu'));