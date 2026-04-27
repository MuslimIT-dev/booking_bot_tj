import { Scenes, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

export const manageServicesScene = new Scenes.BaseScene<MyContext>('manage_services_scene');

manageServicesScene.enter(async (ctx) => {
  const services = await adminService.getAllServices(ctx.botId);

  const buttons = services.map(s => [
    Markup.button.callback(`📦 ${s.name} (${s.price}₽)`, `view_service_${s.id}`)
  ]);

  buttons.push([Markup.button.callback('➕ Добавить услугу', 'add_service')]);
  buttons.push([Markup.button.callback('🔙 Назад в меню', 'back_to_admin')]);

  const text = services.length ? 'Управление услугами:' : 'Услуги пока не добавлены.';

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, Markup.inlineKeyboard(buttons)).catch(() =>
      ctx.reply(text, Markup.inlineKeyboard(buttons))
    );
  } else {
    await ctx.reply(text, Markup.inlineKeyboard(buttons));
  }
});

manageServicesScene.action(/^view_service_(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  const service = await adminService.getServiceById(ctx.botId, id);

  if (!service) {
    await ctx.answerCbQuery('Услуга не найдена');
    return ctx.scene.reenter();
  }

  const text = `📦 *Услуга:* ${service.name}\n⏳ *Длительность:* ${service.durationMinutes} мин.\n💰 *Цена:* ${service.price} ₽`;

  const buttons = [
    [Markup.button.callback('❌ Удалить услугу', `confirm_delete_${id}`)],
    [Markup.button.callback('🔙 Назад к списку', 'back_to_list')]
  ];

  await ctx.answerCbQuery();
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

manageServicesScene.action(/^confirm_delete_(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);

  try {
    await adminService.deleteService(ctx.botId, id);
    await ctx.answerCbQuery('Услуга удалена');
    await ctx.reply('✅ Услуга успешно деактивирована.');
  } catch (e) {
    await ctx.answerCbQuery('Ошибка при удалении', { show_alert: true });
  }

  return ctx.scene.reenter();
});

manageServicesScene.action('add_service', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('add_service_wizard');
});

manageServicesScene.action('back_to_list', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.reenter();
});

manageServicesScene.action('back_to_admin', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('admin_menu');
});