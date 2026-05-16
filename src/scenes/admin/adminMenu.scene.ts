import { Scenes, Markup } from 'telegraf';
import { MyContext } from '../../types';

export const adminMenuScene = new Scenes.BaseScene<MyContext>('admin_menu');

adminMenuScene.enter(async (ctx) => {
  if (ctx.callbackQuery) {
    await ctx.deleteMessage().catch(() => {});
  }
  
  await ctx.reply('🛠 **Панель администратора**\nВыберите раздел для управления:', Markup.inlineKeyboard([
    [Markup.button.callback('👥 Управление сотрудниками', 'manage_employees')],
    [Markup.button.callback('📅 Настроить расписание', 'add_schedule')],
    [Markup.button.callback('📶 Управление услугами', 'manage_service')],
    [Markup.button.callback('📋 Последние записи', 'view_appointments')],
    [Markup.button.callback('📝 Изменить информацию о нас', 'edit_about_info')],
    [Markup.button.callback('⬅️ Выйти', 'exit_admin')]
  ]));
});

adminMenuScene.action('manage_service', (ctx) => ctx.scene.enter('manage_services_scene'));
adminMenuScene.action('manage_employees', (ctx) => ctx.scene.enter('manage_employees_scene'));
adminMenuScene.action('add_schedule', (ctx) => ctx.scene.enter('add_schedule_wizard'));
adminMenuScene.action('view_appointments', (ctx) => ctx.scene.enter('view_appointments_scene'));
adminMenuScene.action('edit_about_info', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('edit_info_wizard');
});
adminMenuScene.action('exit_admin', (ctx) => {
  ctx.reply('Вы вышли из панели управления.');
  return ctx.scene.leave();
});
