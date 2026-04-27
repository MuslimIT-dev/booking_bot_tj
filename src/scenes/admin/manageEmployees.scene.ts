import { Scenes, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

export const manageEmployeesScene = new Scenes.BaseScene<MyContext>('manage_employees_scene');

manageEmployeesScene.enter(async (ctx) => {
  const employees = await adminService.getAllEmployees(ctx.botId);
  const buttons = employees.map(e => [Markup.button.callback(`👤 ${e.name}`, `emp_${e.id}`)]);

  buttons.push([Markup.button.callback('➕ Добавить сотрудника', 'create_employee')]);
  buttons.push([Markup.button.callback('🔙 Назад', 'back_to_menu')]);

  const text = employees.length ? 'Выберите сотрудника для редактирования:' : 'Сотрудников пока нет.';

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, Markup.inlineKeyboard(buttons)).catch(() =>
      ctx.reply(text, Markup.inlineKeyboard(buttons))
    );
  } else {
    await ctx.reply(text, Markup.inlineKeyboard(buttons));
  }
});

manageEmployeesScene.action('back_to_menu', (ctx) => ctx.scene.enter('admin_menu'));
manageEmployeesScene.action('create_employee', (ctx) => ctx.scene.enter('add_employee_wizard'));

manageEmployeesScene.action(/^emp_(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  ctx.scene.session.employeeId = id;

  const emp = await adminService.getEmployeeById(ctx.botId, id);

  if (!emp) {
    await ctx.answerCbQuery('Сотрудник не найден');
    return ctx.scene.reenter();
  }

  const servicesText = emp.employeeServices.map(es => es.service.name).join(', ') || 'Нет услуг';
  const text = `👤 *Сотрудник:* ${emp.name}\n🔹 *Услуги:* ${servicesText}`;
  const buttons = [
    [Markup.button.callback('✏️ Изменить имя', 'edit_name')],
    [Markup.button.callback('🔄 Изменить услуги', 'edit_services')],
    [Markup.button.callback('❌ Удалить', 'delete_emp')],
    [Markup.button.callback('🔙 К списку', 'back_to_list')]
  ];

  await ctx.answerCbQuery();
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  }).catch(async () => {
    await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });
});

manageEmployeesScene.action('back_to_list', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.reenter();
});

manageEmployeesScene.action('delete_emp', async (ctx) => {
  const id = ctx.scene.session.employeeId;
  if (id) {
    await adminService.deleteEmployee(ctx.botId, id);
    await ctx.answerCbQuery('Сотрудник удален', { show_alert: true });
  }
  return ctx.scene.reenter();
});

manageEmployeesScene.action('edit_name', (ctx) => {
  const id = ctx.scene.session.employeeId;
  return ctx.scene.enter('edit_emp_name_wizard', { employeeId: id });
});

manageEmployeesScene.action('edit_services', (ctx) => {
  const id = ctx.scene.session.employeeId;
  return ctx.scene.enter('edit_emp_services_wizard', { employeeId: id });
});