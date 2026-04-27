import { prisma } from "../db/client";
import { MyContext } from "../types";

export const isAdmin = async (ctx: MyContext, next: () => Promise<void>) => {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: {
      telegramId_botId: {
        telegramId: BigInt(ctx.from.id),
        botId: ctx.botId
      }
    }
  });

  const isGlobalAdmin = ctx.from.id.toString() === process.env.GLOBAL_ADMIN_ID;

  if (user?.role === 'ADMIN' || isGlobalAdmin) {
    return next();
  }

  await ctx.reply('⛔ У вас нет прав администратора в этом боте.');
};
