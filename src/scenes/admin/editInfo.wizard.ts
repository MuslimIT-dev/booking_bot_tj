import { Scenes, Composer, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

const step1 = new Composer<MyContext>();
step1.on('text', async (ctx) => {
  const newText = ctx.message.text.trim();
  if (newText.length < 10) {
    return ctx.reply('❌ Текст слишком короткий. Напишите подробнее о компании:');
  }

  try {
    await adminService.updateBotInfo(ctx.botId, newText);
    await ctx.reply('✅ Информация о компании успешно обновлена!');
  } catch (e) {
    console.error(e);
    await ctx.reply('❌ Ошибка при сохранении данных.');
  }
  return ctx.scene.enter('admin_menu');
});

export const editInfoWizard = new Scenes.WizardScene<MyContext>(
  'edit_info_wizard',
  async (ctx) => {
    const currentInfo = await adminService.getBotInfo(ctx.botId);
    
    await ctx.reply(
      `ℹ️ *Текущая информация о компании:*\n\n_${currentInfo}_\n\n` +
      `✍️ Введите новый текст для описания компании (или нажмите /cancel для отмены):`,
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },
  step1
);
