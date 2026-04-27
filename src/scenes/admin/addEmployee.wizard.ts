import { Scenes, Composer, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

const step1 = new Composer<MyContext>();
step1.on('text', async (ctx) => {
  ctx.scene.session.name = ctx.message.text;
  const services = await adminService.getAllServices(ctx.botId);

  if (services.length === 0) {
    await ctx.reply('Сначала добавьте услуги в базу данных.');
    return ctx.scene.leave();
  }

  ctx.scene.session.selectedServices = [];
  const keyboard = services.map(s => [Markup.button.callback(s.name, `select_${s.id}`)]);
  keyboard.push([Markup.button.callback('✅ Готово', 'done')]);

  await ctx.reply('Выберите услуги, которые оказывает сотрудник:', Markup.inlineKeyboard(keyboard));
  return ctx.wizard.next();
});

const step2 = new Composer<MyContext>();
step2.action(/^select_(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  const session = ctx.scene.session;

  if (!session.selectedServices) session.selectedServices = [];

  if (session.selectedServices.includes(id)) {
    session.selectedServices = session.selectedServices.filter((sId: number) => sId !== id);
  } else {
    session.selectedServices.push(id);
  }

  const services = await adminService.getAllServices(ctx.botId);
  const keyboard = services.map(s => {
    const isSelected = session.selectedServices?.includes(s.id);
    return [Markup.button.callback(`${isSelected ? '✅ ' : ''}${s.name}`, `select_${s.id}`)];
  });
  keyboard.push([Markup.button.callback('✅ Завершить выбор', 'done')]);

  await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(keyboard).reply_markup);
  await ctx.answerCbQuery();
});

step2.action('done', async (ctx) => {
  await ctx.answerCbQuery();
  const session = ctx.scene.session;

  if (!session.selectedServices || session.selectedServices.length === 0) {
    return ctx.answerCbQuery('Выберите хотя бы одну услугу!', { show_alert: true });
  }

  await adminService.createEmployee(ctx.botId, session.name!, session.selectedServices);

  await ctx.deleteMessage().catch(() => {});
  await ctx.reply(`✅ Сотрудник ${session.name} успешно добавлен.`);

  return ctx.scene.enter('admin_menu');
});

export const addEmployeeWizard = new Scenes.WizardScene<MyContext>(
  'add_employee_wizard',
  async (ctx) => {
    await ctx.reply('Введите ФИО нового сотрудника:');
    return ctx.wizard.next();
  },
  step1,
  step2
);