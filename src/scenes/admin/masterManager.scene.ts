import { Scenes, Markup } from 'telegraf';
import { MyContext } from '../../types';
import { prisma } from '../../db/client';
import { launchSingleBot, stopBot } from '../../bot';

export const masterManagerScene = new Scenes.BaseScene<MyContext>('master_manager_scene');

masterManagerScene.enter(async (ctx) => {
  const bots = await prisma.bot.findMany();
  const buttons = bots.map(b => [
    Markup.button.callback(`🤖 Бот ID: ${b.id} (${b.token.slice(-7)})`, `manage_bot_${b.id}`)
  ]);

  buttons.push([Markup.button.callback('➕ Добавить нового бота', 'add_new_bot')]);

  await ctx.reply('👑 **Панель Глобального Админа**\nВыберите бота для настройки:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

masterManagerScene.action(/^manage_bot_(\d+)$/, async (ctx) => {
  const botId = Number(ctx.match[1]);
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return ctx.answerCbQuery('Бот не найден');

  const text = `⚙️ **Настройка бота ID: ${botId}**\nТокен: \`${bot.token}\`\nАдмин ID: \`${bot.ownerId}\``;
  const buttons = [
    [Markup.button.callback('👤 Сменить админа', `change_admin_${botId}`)],
    [Markup.button.callback('🗑 Удалить бота', `delete_bot_${botId}`)],
    [Markup.button.callback('🔙 Назад', 'back_to_list')]
  ];

  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
});

masterManagerScene.action(/^delete_bot_(\d+)$/, async (ctx) => {
  const botId = Number(ctx.match[1]);
  try {
    await prisma.bot.delete({ where: { id: botId } });
    await stopBot(botId);
    await ctx.answerCbQuery('Бот и все его данные удалены');
    return ctx.scene.reenter();
  } catch (e) {
    console.error(e);
    await ctx.answerCbQuery('Ошибка: удалите зависимости бота сначала', { show_alert: true });
  }
});

masterManagerScene.action('add_new_bot', (ctx) => ctx.scene.enter('register_bot_wizard'));
masterManagerScene.action('back_to_list', (ctx) => ctx.scene.reenter());

export const registerBotWizard = new Scenes.WizardScene<MyContext>(
  'register_bot_wizard',
  async (ctx) => {
    await ctx.reply('🚀 **Шаг 1/2**: Пришлите токен нового бота:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const token = (ctx.message as any)?.text?.trim();
    if (!/^\d+:[\w-]+$/.test(token)) return ctx.reply('❌ Ошибка токена. Еще раз:');
    ctx.scene.session.tempToken = token;
    await ctx.reply('✅ Ок. **Шаг 2/2**: Пришлите Telegram ID админа для этого бота:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const adminId = Number((ctx.message as any)?.text);
    const token = ctx.scene.session.tempToken!;
    
    try {
      const newBot = await prisma.bot.create({ data: { token, ownerId: BigInt(adminId) } });
      await prisma.user.upsert({
        where: {
          telegramId_botId: {
            telegramId: BigInt(adminId),
            botId: newBot.id
          }
        },
        update: { role: 'ADMIN' },
        create: {
          telegramId: BigInt(adminId),
          botId: newBot.id,
          role: 'ADMIN',
          firstName: 'Admin'
        }
      });

      await ctx.reply(`⏳ Добавляем бота в базу (ID: ${newBot.id}). Пробуем запустить...`);
      
      launchSingleBot(newBot)
        .then(() => {
            ctx.reply(`🎉 Бот (ID: ${newBot.id}) успешно запущен и работает!`);
        })
        .catch((err) => {
            ctx.reply(`❌ Ошибка запуска бота (ID: ${newBot.id}). Токен верный? Ошибка: ${err.message}`);
        });
    } catch (e) {
      await ctx.reply('❌ Ошибка БД при создании бота');
    }
    
    return ctx.scene.enter('master_manager_scene');
  }
);

export const changeAdminWizard = new Scenes.WizardScene<MyContext>(
  'change_admin_wizard',
  async (ctx) => {
    await ctx.reply('Введите новый Telegram ID админа:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const newId = Number((ctx.message as any)?.text);
    const botId = (ctx.scene.state as any).botId;
    await prisma.bot.update({ where: { id: botId }, data: { ownerId: BigInt(newId) } });
    await prisma.user.upsert({
      where: { telegramId_botId: { telegramId: BigInt(newId), botId: botId } },
      update: { role: 'ADMIN' },
      create: { telegramId: BigInt(newId), botId: botId, role: 'ADMIN' }
    });
    await ctx.reply('✅ Админ изменен.');
    return ctx.scene.enter('master_manager_scene');
  }
);
