import { Markup } from 'telegraf';

export const adminMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('➕ Услуги', 'admin_services')],
  [Markup.button.callback('👥 Сотрудники', 'admin_employees')],
  [Markup.button.callback('📅 Расписание', 'admin_schedule')],
  [Markup.button.callback('📋 Записи', 'admin_appointments')],
  [Markup.button.callback('🔙 Выйти', 'admin_exit')]
]);