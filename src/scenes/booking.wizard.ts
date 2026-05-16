import { Scenes, Composer, Markup } from 'telegraf';
import { MyContext } from '../types';
import { bookingService } from '../services/booking.service';
import { getFreeSlots } from '../services/schedule.service';
import { generateCalendarKeyboard as getCalendar } from '../keyboards/calendar';
import { format } from 'date-fns';
import { prisma } from '../db/client';

const mainButtons = Markup.keyboard([['📅 Записаться', '📋 Мои записи']]).resize();

const isEventType = (type?: string) => {
  return type && type !== 'SERVICE';
};

const step0 = new Composer<MyContext>();
step0.action(/^cat_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const category = ctx.match[1];
  const services = await bookingService.getServices(ctx.botId);
  const filtered = services.filter((s) => s.type === category);

  const buttons = filtered.map((s) => [
    Markup.button.callback(`${s.name} — ${s.price}₽`, `service_${s.id}`),
  ]);

  await ctx.editMessageText('Выберите конкретное направление:', Markup.inlineKeyboard(buttons));
  return ctx.wizard.next();
});

const step1 = new Composer<MyContext>();
step1.action(/^service_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const serviceId = Number(ctx.match[1]);
  ctx.scene.session.serviceId = serviceId;

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return ctx.scene.leave();

  ctx.scene.session.serviceType = service.type;

  if (isEventType(service.type) && service.eventDate) {
    ctx.scene.session.date = format(service.eventDate, 'yyyy-MM-dd');
    ctx.scene.session.time = service.startTime || '00:00';

    const employees = await bookingService.getEmployeesByService(ctx.botId, serviceId);
    if (!employees.length) {
      await ctx.reply('К сожалению, организатор еще не назначен.');
      return ctx.scene.leave();
    }
    ctx.scene.session.employeeId = employees[0].id;

    await ctx.reply(
      `✅ Вы выбрали: ${service.name}\n📅 Дата: ${ctx.scene.session.date}\n⏰ Время: ${ctx.scene.session.time}\n\nПожалуйста, отправьте ваш номер телефона:`,
      Markup.keyboard([[Markup.button.contactRequest('📱 Отправить контакт')]]).oneTime().resize()
    );
    return ctx.wizard.selectStep(6);
  }

  const employees = await bookingService.getEmployeesByService(ctx.botId, serviceId);
  const buttons = employees.map((e) => [Markup.button.callback(`👤 ${e.name}`, `emp_${e.id}`)]);
  await ctx.editMessageText('Выберите специалиста:', Markup.inlineKeyboard(buttons));
  return ctx.wizard.next();
});

const step2 = new Composer<MyContext>();
step2.action(/^emp_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.session.employeeId = Number(ctx.match[1]);
  ctx.scene.session.calendarMonth = format(new Date(), 'yyyy-MM');
  await ctx.editMessageText(
    'Выберите дату:',
    getCalendar(new Date(ctx.scene.session.calendarMonth + '-01'))
  );
  return ctx.wizard.next();
});

const step3 = new Composer<MyContext>();
step3.action(/^month_(\d{4}-\d{2})$/, async (ctx) => {
  ctx.scene.session.calendarMonth = ctx.match[1];
  await ctx.editMessageReplyMarkup(
    getCalendar(new Date(ctx.match[1] + '-01')).reply_markup
  );
  await ctx.answerCbQuery();
});

step3.action(/^date_(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  await ctx.answerCbQuery();
  const selectedDate = ctx.match[1];
  ctx.scene.session.date = selectedDate;

  const slots = await getFreeSlots(
    ctx.botId,
    ctx.scene.session.employeeId!,
    ctx.scene.session.serviceId!,
    selectedDate
  );

  if (!slots.length) return ctx.reply('На эту дату нет свободных мест.');

  const buttons = [];
  for (let i = 0; i < slots.length; i += 3) {
    buttons.push(slots.slice(i, i + 3).map((t) => Markup.button.callback(t, `time_${t}`)));
  }
  await ctx.editMessageText(`Свободное время на ${selectedDate}:`, Markup.inlineKeyboard(buttons));
  return ctx.wizard.next();
});

const step4 = new Composer<MyContext>();
step4.action(/^time_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.session.time = ctx.match[1];
  await ctx.reply(
    'Для завершения отправьте ваш номер телефона (нажмите кнопку):',
    Markup.keyboard([[Markup.button.contactRequest('📱 Отправить контакт')]]).oneTime().resize()
  );
  return ctx.wizard.next();
});

step4.on('message', async (ctx) => {
  await ctx.reply('Пожалуйста, выберите время, нажав на кнопку выше 👆');
});

const step5 = new Composer<MyContext>();
step5.on(['message', 'contact'], async (ctx) => {
  const msg = ctx.message as any;
  const phone = msg.contact?.phone_number || msg.text;

  if (!phone || phone.length < 7) {
    return ctx.reply('Пожалуйста, введите корректный номер телефона.');
  }

  ctx.scene.session.contact = phone;
  const service = await prisma.service.findUnique({ where: { id: ctx.scene.session.serviceId } });

  const typeNames: any = { SERVICE: 'Услуга', TRAINING: 'Тренинг', WORKSHOP: 'Мастер-класс', COURSE: 'Курс' };
  
  let msgText = `📝 *Информация о записи:*\n` +
                `🔹 *Тип:* ${typeNames[service?.type || 'SERVICE']}\n` +
                `🔹 *Название:* ${service?.name}\n` +
                `📅 *Дата:* ${ctx.scene.session.date}\n` +
                `⏰ *Время:* ${ctx.scene.session.time}`;

  if (service?.address) {
    msgText += `\n📍 *Адрес проведения:* _${service.address}_`;
  }

  await ctx.reply('Проверьте данные:', Markup.removeKeyboard());
  await ctx.reply(msgText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Подтвердить', 'confirm'), Markup.button.callback('❌ Отмена', 'cancel')]
    ])
  });
  return ctx.wizard.next();
});


const step6 = new Composer<MyContext>();
step6.action('confirm', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await bookingService.createAppointment(ctx.botId, {
      telegramId: ctx.from!.id,
      ...ctx.scene.session,
    });
    await ctx.reply('✅ Вы успешно записаны! Ждем вас.', mainButtons);
  } catch {
    await ctx.reply('❌ Извините, места закончились или произошла ошибка.', mainButtons);
  }
  return ctx.scene.leave();
});

step6.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Запись отменена.', mainButtons);
  return ctx.scene.leave();
});

export const bookingWizard = new Scenes.WizardScene<MyContext>(
  'booking_wizard',
  async (ctx) => {
    const services = await bookingService.getServices(ctx.botId);

    const categories = [
      { id: 'SERVICE', label: '💆 Услуги' },
      { id: 'TRAINING', label: '👥 Тренинги' },
      { id: 'WORKSHOP', label: '🛠 МК' },
      { id: 'COURSE', label: '🎓 Курсы' },
    ];

    const buttons = categories
      .filter((c) => services.some((s) => s.type === c.id))
      .map((c) => [Markup.button.callback(c.label, `cat_${c.id}`)]);

    if (!buttons.length) {
      await ctx.reply('К сожалению, активных записей нет.', mainButtons);
      return ctx.scene.leave();
    }

    await ctx.reply('Что вас интересует?', {
      ...mainButtons,
      ...Markup.inlineKeyboard(buttons),
    });
    return ctx.wizard.next();
  },
  step0,
  step1,
  step2,
  step3,
  step4,
  step5,
  step6
);
