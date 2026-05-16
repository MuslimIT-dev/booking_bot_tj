import { Scenes, Composer, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

interface AddServiceState {
  name?: string;
  type?: 'SERVICE' | 'TRAINING' | 'WORKSHOP' | 'COURSE';
  duration?: number;
  price?: number;
  maxCapacity?: number;
  eventDate?: string;
  startTime?: string;
  address?: string;
}

const step1 = new Composer<MyContext>();
step1.on('text', async (ctx) => {
  (ctx.wizard.state as AddServiceState).name = ctx.message.text;
  await ctx.reply('Выберите тип:', Markup.inlineKeyboard([
    [Markup.button.callback('💆 Услуга (1 на 1)', 'type_SERVICE')],
    [Markup.button.callback('🎓 Курс', 'type_COURSE')],
    [Markup.button.callback('👥 Тренинг', 'type_TRAINING')],
    [Markup.button.callback('🛠 Мастер-класс', 'type_WORKSHOP')]
  ]));
  return ctx.wizard.next();
});

const step2 = new Composer<MyContext>();
step2.action(/^type_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  (ctx.wizard.state as AddServiceState).type = ctx.match[1] as any;
  await ctx.editMessageText('Введите длительность в минутах (например: 60):');
  return ctx.wizard.next();
});

const step3 = new Composer<MyContext>();
step3.on('text', async (ctx) => {
  const duration = parseInt(ctx.message.text);
  if (isNaN(duration) || duration <= 0) return ctx.reply('Введите число минут.');
  (ctx.wizard.state as AddServiceState).duration = duration;
  await ctx.reply('Введите стоимость (например: 1500):');
  return ctx.wizard.next();
});

const step4 = new Composer<MyContext>();
step4.on('text', async (ctx) => {
  const price = parseFloat(ctx.message.text);
  if (isNaN(price) || price < 0) return ctx.reply('Введите корректную цену.');
  const state = ctx.wizard.state as AddServiceState;
  state.price = price;

  if (state.type !== 'SERVICE') {
    const prompt = state.type === 'COURSE' ? 'дату старта курса' : 'дату проведения';
    await ctx.reply(`Введите ${prompt} (ГГГГ-ММ-ДД, например 2026-12-31):`);
    return ctx.wizard.next(); 
  }

  state.maxCapacity = 1;
  await showSummary(ctx);
  return ctx.wizard.selectStep(7);
});

const step5 = new Composer<MyContext>();
step5.on('text', async (ctx) => {
  const dateStr = ctx.message.text.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return ctx.reply('Формат: ГГГГ-ММ-ДД');
  (ctx.wizard.state as AddServiceState).eventDate = dateStr;
  await ctx.reply('Введите время начала (ЧЧ:ММ, например 08:00):');
  return ctx.wizard.next();
});

const step6 = new Composer<MyContext>();
step6.on('text', async (ctx) => {
  const state = ctx.wizard.state as AddServiceState;
  const input = ctx.message.text.trim();

  if (!state.startTime) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegexRegex.test(input)) return ctx.reply('Формат: ЧЧ:ММ (например 08:00)');
    state.startTime = input;
    return await ctx.reply('Введите адрес проведения мероприятия/МК:');
  }

  state.address = input;
  await ctx.reply('Введите вместимость (кол-во мест):');
  return ctx.wizard.next();
});

const step7 = new Composer<MyContext>();
step7.on('text', async (ctx) => {
  const capacity = parseInt(ctx.message.text);
  if (isNaN(capacity) || capacity <= 0) return ctx.reply('Введите целое число больше 0');
  
  (ctx.wizard.state as AddServiceState).maxCapacity = capacity;
  await showSummary(ctx);
  return ctx.wizard.next();
});

const step8 = new Composer<MyContext>();
step8.action('confirm_create', async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as AddServiceState;
  try {
    await adminService.createService(
      ctx.botId, state.name!, state.duration!, state.price!, 
      state.type, state.maxCapacity, 
      state.eventDate ? new Date(state.eventDate) : undefined, 
      state.startTime,
      state.address
    );
    await ctx.editMessageText('✅ Успешно сохранено!');
  } catch (e) { 
    console.error(e);
    await ctx.editMessageText('❌ Ошибка сохранения.'); 
  }
  return ctx.scene.enter('admin_menu');
});

step8.action('cancel_create', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Отменено.');
  return ctx.scene.enter('admin_menu');
});

async function showSummary(ctx: MyContext) {
  const state = ctx.wizard.state as AddServiceState;
  const typeMap = { SERVICE: 'Услуга', COURSE: 'Курс', TRAINING: 'Тренинг', WORKSHOP: 'Мастер-класс' };
  let summary = `📝 *Итог:*\n\n🔹 *Название:* ${state.name}\n🔹 *Тип:* ${typeMap[state.type!]}\n⏳ *Длит.:* ${state.duration} мин\n💰 *Цена:* ${state.price} ₽\n👥 *Мест:* ${state.maxCapacity}`;
  if (state.eventDate) {
    summary += `\n📅 *Дата:* ${state.eventDate}\n⏰ *Время:* ${state.startTime}\n📍 *Адрес:* ${state.address || 'Не указан'}`;
  }

  await ctx.reply(summary, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Подтвердить', 'confirm_create')],
      [Markup.button.callback('❌ Отмена', 'cancel_create')]
    ])
  });
}

export const addServiceWizard = new Scenes.WizardScene<MyContext>(
  'add_service_wizard',
  async (ctx) => {
    const state = ctx.wizard.state as any;
    Object.keys(state).forEach(key => delete state[key]);
    await ctx.reply('Введите название:');
    return ctx.wizard.next();
  },
  step1, step2, step3, step4, step5, step6, step7, step8
);
