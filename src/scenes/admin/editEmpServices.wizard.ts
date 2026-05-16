import { Scenes, Composer, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

const step1 = new Composer<MyContext>();

async function renderServicesKeyboard(ctx: MyContext) {
  const allServices = await adminService.getAllServices(ctx.botId);
  const selected = ctx.scene.session.selectedServices || [];

  const buttons = allServices.map((s: any) => {
    const isSelected = selected.includes(s.id);
    return [Markup.button.callback(`${isSelected ? '✅ ' : ''}${s.name}`, `toggle_s_${s.id}`)];
  });

  buttons.push([Markup.button.callback('💾 Сохранить', 'save_services')]);
  buttons.push([Markup.button.callback('❌ Отмена', 'cancel')]);

  const text = 'Выберите услуги, которые оказывает этот сотрудник:';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, Markup.inlineKeyboard(buttons));
  } else {
    await ctx.reply(text, Markup.inlineKeyboard(buttons));
  }
}

step1.action(/^toggle_s_(\d+)$/, async (ctx) => {
  const match = ctx.match as RegExpMatchArray;
  const serviceId = Number(match[1]);
  if (!ctx.scene.session.selectedServices) ctx.scene.session.selectedServices = [];

  const selected = ctx.scene.session.selectedServices;
  if (selected.includes(serviceId)) {
    ctx.scene.session.selectedServices = selected.filter((id: number) => id !== serviceId);
  } else {
    ctx.scene.session.selectedServices.push(serviceId);
  }

  await renderServicesKeyboard(ctx);
  await ctx.answerCbQuery();
});

step1.action('save_services', async (ctx) => {
  const { employeeId, selectedServices } = ctx.scene.session;
  if (employeeId) {
    await adminService.updateEmployeeServices(ctx.botId, employeeId, selectedServices || []);
    await ctx.answerCbQuery('Услуги обновлены');
    await ctx.reply('✅ Список услуг сотрудника обновлен.');
  }
  return ctx.scene.enter('manage_employees_scene');
});

step1.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('manage_employees_scene');
});

export const editEmpServicesWizard = new Scenes.WizardScene<MyContext>(
  'edit_emp_services_wizard',
  async (ctx) => {
    const state = ctx.scene.state as { employeeId?: number };
    const employeeId = state.employeeId;

    if (!employeeId) {
      await ctx.reply('Ошибка: сотрудник не выбран.');
      return ctx.scene.enter('manage_employees_scene');
    }

    ctx.scene.session.employeeId = employeeId;

    const emp = await adminService.getEmployeeById(ctx.botId, employeeId);
    ctx.scene.session.selectedServices = emp?.employeeServices.map((es: any) => es.serviceId) || [];

    await renderServicesKeyboard(ctx);
    return ctx.wizard.next();
  },
  step1
);
