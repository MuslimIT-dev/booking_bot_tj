import { Telegraf, session, Markup, Scenes } from 'telegraf';
import * as dotenv from 'dotenv';
import { MyContext } from './types';
import { stage } from './scenes';
import { isAdmin } from './middleware/auth';
import { bookingService } from './services/booking.service';
import { prisma } from './db/client';
import { masterManagerScene, registerBotWizard, changeAdminWizard } from './scenes/admin/masterManager.scene';

dotenv.config();

export function setupBotLogic(bot: Telegraf<MyContext>, botDbId: number) {
  bot.use(async (ctx, next) => {
    ctx.botId = botDbId;
    return next();
  });

  bot.use(session());
  bot.use(stage.middleware());

  const sendMainMenu = async (ctx: MyContext, text: string) => {
    return await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.keyboard([['📅 Записаться'], ['📋 Мои записи']]).resize(),
    });
  };

  bot.start(async (ctx) => await sendMainMenu(ctx, 'Добро пожаловать!'));
  bot.hears('📅 Записаться', (ctx) => ctx.scene.enter('booking_wizard'));

  bot.hears('📋 Мои записи', async (ctx: MyContext) => {
    try {
      if (!ctx.from?.id) return;

      console.log(`Ищем записи для BotID: ${ctx.botId}, TG ID: ${ctx.from.id}`);

      const apps = await bookingService.getClientAppointments(ctx.botId, ctx.from.id);
      const activeApps = apps.filter((a) => a.status === 'PENDING' || a.status === 'CONFIRMED');

      if (activeApps.length === 0) {
        return await ctx.reply('У вас пока нет активных записей.');
      }

      await ctx.reply('📋 *Ваши активные записи:*', { parse_mode: 'Markdown' });

      for (const a of activeApps) {
        const msg = `📅 *Дата:* ${a.appointmentDate.toLocaleDateString('ru-RU')}\n⏰ *Время:* ${a.startTime}\n🔹 *Услуга:* ${a.service.name}\n👤 *Мастер:* ${a.employee.name}`;

        await ctx.reply(msg, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отменить запись', `cancel_app_${a.id}`)],
          ]),
        });
      }
    } catch (error) {
      console.error('Ошибка при получении записей:', error);
      await ctx.reply('⚠️ Не удалось загрузить ваши записи.');
    }
  });

  bot.command('admin', isAdmin, (ctx) => ctx.scene.enter('admin_menu'));

  bot.action(/^cancel_app_(\d+)$/, async (ctx) => {
    const appId = Number((ctx as any).match[1]);
    await prisma.appointment.update({ where: { id: appId }, data: { status: 'CANCELLED' } });
    await ctx.answerCbQuery('Запись отменена');
    if (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message) {
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n❌ ОТМЕНЕНО');
    }
  });
}

const masterBot = new Telegraf<MyContext>(process.env.MASTER_BOT_TOKEN!);
const GLOBAL_ADMIN_ID = Number(process.env.GLOBAL_ADMIN_ID);

const masterStage = new Scenes.Stage<MyContext>([
  masterManagerScene,
  registerBotWizard,
  changeAdminWizard,
]);

masterBot.use(session());
masterBot.use(masterStage.middleware());

masterBot.command('start', async (ctx) => {
  if (ctx.from.id !== GLOBAL_ADMIN_ID) return ctx.reply('⛔ Нет прав.');
  await ctx.scene.enter('master_manager_scene');
});

async function startSystem() {
  masterBot.launch().catch((err) => console.error('❌ Мастер-бот ошибка:', err.message));

  const allBots = await prisma.bot.findMany();
  const masterToken = process.env.MASTER_BOT_TOKEN;

  console.log(`📡 Запуск ${allBots.length} ботов из базы...`);

  for (const botData of allBots) {
    if (botData.token === masterToken) continue;

    try {
      const bot = new Telegraf<MyContext>(botData.token);
      setupBotLogic(bot, botData.id);
      bot.launch().catch((err) => console.error(`❌ Ошибка бота [ID: ${botData.id}]: ${err.message}`));
    } catch (err: any) {
      console.error(`❌ Ошибка настройки [ID: ${botData.id}]`);
    }
  }
}

startSystem().then(() => console.log('🚀 Мульти-ботовая система запущена.'));

process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

export const runningBots = new Map<number, Telegraf<MyContext>>();

export async function launchSingleBot(botData: any) {
  try {
    const bot = new Telegraf<MyContext>(botData.token);
    setupBotLogic(bot, botData.id);
    await bot.launch();
    runningBots.set(botData.id, bot); // Сохраняем экземпляр, чтобы не запустить дубликат
    console.log(`✅ Новый бот запущен: ID ${botData.id}`);
  } catch (err) {
    console.error(`❌ Ошибка запуска бота ID ${botData.id}:`, err);
  }
}
