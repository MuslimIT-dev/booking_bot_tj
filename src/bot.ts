import { Telegraf, session, Markup, Scenes } from 'telegraf';
import * as dotenv from 'dotenv';
import { MyContext } from './types';
import { stage } from './scenes';
import { isAdmin } from './middleware/auth';
import { bookingService } from './services/booking.service';
import { adminService } from './services/admin.service';
import { prisma } from './db/client';
import { masterManagerScene, registerBotWizard, changeAdminWizard } from './scenes/admin/masterManager.scene';

dotenv.config();

export const runningBots = new Map<number, { instance: Telegraf<MyContext>, status: 'online' | 'offline' | 'error' }>();

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
      ...Markup.keyboard([
        ['📅 Записаться', '📋 Мои записи'],
        ['ℹ️ О нас']
      ]).resize(),
    });
  };

  bot.start(async (ctx) => await sendMainMenu(ctx, 'Добро пожаловать! Выберите интересующий вас пункт меню:'));
  
  bot.hears('📅 Записаться', (ctx) => ctx.scene.enter('booking_wizard'));

  bot.hears('ℹ️ О нас', async (ctx: MyContext) => {
    try {
      const currentInfo = await adminService.getBotInfo(ctx.botId);
    
      await ctx.reply(`ℹ️ *О нашей компании:*\n\n${currentInfo}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error(error);
      await ctx.reply('⚠️ Не удалось загрузить информацию о компании.');
    }
  });

  bot.hears('📋 Мои записи', async (ctx: MyContext) => {
    if (!ctx.from) return;
    
    try {
      const apps = await bookingService.getClientAppointments(ctx.botId, ctx.from.id);
      const activeApps = apps.filter(a => a.status === 'PENDING');

      if (activeApps.length === 0) {
        return await sendMainMenu(ctx, 'У вас пока нет активных записей.');
      }
      
      await ctx.reply('📋 *Ваши активные записи:*', { parse_mode: 'Markdown' });
      
      for (const a of activeApps) {
        let msg = `📅 *Дата:* ${a.appointmentDate.toLocaleDateString('ru-RU')}\n` +
                  `⏰ *Время:* ${a.startTime}\n` +
                  `🔹 *Направление:* ${a.service.name}\n` +
                  `👤 *Специалист:* ${a.employee.name}`;

        if (a.service.address) {
          msg += `\n📍 *Адрес проведения:* _${a.service.address}_`;
        }

        await ctx.reply(msg, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('❌ Отменить запись', `cancel_app_${a.id}`)]])
        });
      }
    } catch (error) {
      console.error(error);
      await ctx.reply('⚠️ Ошибка при загрузке списка записей.');
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

export async function launchSingleBot(botData: any) {
  try {
    const bot = new Telegraf<MyContext>(botData.token);
    setupBotLogic(bot, botData.id);
    await bot.launch({ dropPendingUpdates: true });
    runningBots.set(botData.id, { instance: bot, status: 'online' });
    console.log(`✅ Новый бот запущен: ID ${botData.id}`);
  } catch (err) {
    runningBots.set(botData.id, { instance: new Telegraf<MyContext>(botData.token), status: 'error' });
    console.error(`❌ Ошибка запуска бота ID ${botData.id}:`, err);
    throw err;
  }
}

async function startSystem() {
  masterBot.launch().catch((err) => console.error('❌ Мастер-бот ошибка:', err.message));
  console.log('👑 Мастер-бот запущен.');

  try {
    const allBots = await prisma.bot.findMany();
    const masterToken = process.env.MASTER_BOT_TOKEN;

    const clientBots = allBots.filter(b => b.token !== masterToken);
    console.log(`📡 Запуск ${clientBots.length} клиентских ботов из базы...`);

    const launchPromises = clientBots.map(botData => {
      if (!runningBots.has(botData.id)) {
        return launchSingleBot(botData);
      }
      return Promise.resolve();
    });

    const results = await Promise.allSettled(launchPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`🚀 Мульти-ботовая система инициализирована. Успешно: ${successful}/${clientBots.length}`);

    setInterval(healthCheckBots, 5 * 60 * 1000);
  } catch (err) {
    console.error('❌ Критическая ошибка БД при старте системы:', err);
  }
}

async function healthCheckBots() {
  console.log('🩺 Запуск Health Check...');
  for (const [id, botData] of runningBots.entries()) {
    try {
      if (botData.status === 'online') {
        await botData.instance.telegram.getMe(); 
      }
    } catch (e) {
      console.error(`⚠️ Бот ID ${id} отвалился. Пытаемся перезапустить...`);
      botData.status = 'error';
    }
  }
}

export async function stopBot(botId: number) {
  const botData = runningBots.get(botId);
  if (botData) {
    try {
      botData.instance.stop('uninstalled');
      runningBots.delete(botId);
      console.log(`🛑 Бот с ID ${botId} успешно остановлен.`);
    } catch (err) {
      console.error(`Ошибка при остановке бота ${botId}:`, err);
    }
  }
}

startSystem();

const shutdown = () => {
  console.log('Остановка всех ботов...');
  masterBot.stop('SIGINT');
  for (const [id, botData] of runningBots.entries()) {
    botData.instance.stop('SIGINT');
  }
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
