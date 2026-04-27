import { Markup } from 'telegraf';

export async function clearChat(ctx: any, count: number = 3) {
    const messageId = ctx.message?.message_id || ctx.callbackQuery?.message?.message_id;
    if (!messageId) return;
  
    for (let i = 0; i < count; i++) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, messageId - i).catch(() => {});
      } catch (e) {
      }
    }
  }

  export const sendMainMenu = async (ctx: any, text: string = 'Выберите действие:') => {
    return await ctx.reply(text, Markup.keyboard([
      ['📅 Записаться'],
      ['📋 Мои записи']
    ]).resize());
  };