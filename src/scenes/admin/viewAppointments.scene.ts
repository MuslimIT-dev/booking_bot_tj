import { Scenes, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

export const viewAppointmentsScene = new Scenes.BaseScene<MyContext>('view_appointments_scene');

viewAppointmentsScene.enter(async (ctx) => {
  const apps = await adminService.getAllAppointments(ctx.botId);
  
  if (!apps.length) {
    await ctx.reply('Записей пока нет.', Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Назад в меню', 'back')]
    ]));
    return;
  }

  let report = '📋 *Список последних записей:*\n\n';
  
  apps.forEach((a, i) => {
    const dateStr = a.appointmentDate.toLocaleDateString('ru-RU');
    report += `${i + 1}. 📅 *${dateStr}* | ⏰ *${a.startTime}*\n`;
    report += `   🔹 *Услуга:* ${a.service.name}\n`;
    report += `   👤 *Мастер:* ${a.employee.name}\n`;
    report += `   📞 *Клиент:* ${a.clientContact}\n`;
    report += `   ---------------------------\n`;
  });

  await ctx.reply(report, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад в меню', 'back')]])
  });
});

viewAppointmentsScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('admin_menu');
});
