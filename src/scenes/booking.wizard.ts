import { Scenes, Composer, Markup } from 'telegraf';
import { MyContext } from '../types';
import { bookingService } from '../services/booking.service';
import { getFreeSlots } from '../services/schedule.service';
import { paymentService } from '../services/payment.service';
import { generateCalendarKeyboard as getCalendar } from '../keyboards/calendar';
import { format } from 'date-fns';
import { prisma } from '../db/client';

const mainButtons = Markup.keyboard([['📅 Записаться', '📋 Мои записи']]).resize();

const isEventType = (type?: string) => {
  return type && type !== 'SERVICE';
};

const getServiceTypeName = (type: string) => {
  const types: Record<string, string> = {
    'SERVICE': 'Услуга',
    'TRAINING': 'Тренинг',
    'WORKSHOP': 'Мастер-класс',
    'COURSE': 'Курс'
  };
  return types[type] || 'Запись';
};

/**
 * STEP 0 — Категории
 */
const step0 = new Composer<MyContext>();
step0.action(/^cat_(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const match = ctx.match as RegExpMatchArray;
    const category = match[1]; // ✅ Исправлен индекс совпадения
    const services = await bookingService.getServices(ctx.botId);
    const filtered = services.filter((s: any) => s.type === category);

    const buttons = filtered.map((s: any) => [
      Markup.button.callback(`${s.name} — ${s.price}₽`, `service_${s.id}`),
    ]);

    await ctx.editMessageText('Выберите конкретное направление:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  } catch (e: any) {
    console.error('Ошибка на шаге 0:', e);
    await ctx.reply('⚠️ Произошла ошибка. Попробуйте снова.');
    return ctx.scene.leave();
  }
});

/**
 * STEP 1 — Выбор конкретной услуги
 */
const step1 = new Composer<MyContext>();
step1.action(/^service_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const match = ctx.match as RegExpMatchArray;
    const serviceId = Number(match[1]); // ✅ Исправлен индекс совпадения
    ctx.scene.session.serviceId = serviceId;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return ctx.scene.leave();

    ctx.scene.session.serviceType = service.type;

    if (isEventType(service.type) && service.eventDate) {
      ctx.scene.session.date = format(service.eventDate, 'yyyy-MM-dd');
      ctx.scene.session.time = service.startTime || '00:00';

      const employees = await bookingService.getEmployeesByService(ctx.botId, serviceId);
      if (!employees.length) {
        await ctx.reply('К сожалению, организатор не назначен.');
        return ctx.scene.leave();
      }

      ctx.scene.session.employeeId = employees[0].id;

      await ctx.reply(
        `✅ Вы выбрали: ${service.name}\n📅 Дата: ${ctx.scene.session.date}\n⏰ Время: ${ctx.scene.session.time}\n\nОтправьте номер телефона:`,
        Markup.keyboard([
          [Markup.button.contactRequest('📱 Отправить контакт')]
        ]).oneTime().resize()
      );

      return ctx.wizard.next(); // ❗ ВАЖНО: НЕ selectStep
    }

    const employees = await bookingService.getEmployeesByService(ctx.botId, serviceId);
    const buttons = employees.map((e: any) => [Markup.button.callback(`👤 ${e.name}`, `emp_${e.id}`)]);
    await ctx.editMessageText('Выберите специалиста:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  } catch (e: any) {
    console.error('Ошибка на шаге 1:', e);
    await ctx.reply('⚠️ Ошибка при выборе направления.');
    return ctx.scene.leave();
  }
});

/**
 * STEP 2 — Выбор сотрудника (для SERVICE)
 */
const step2 = new Composer<MyContext>();
step2.action(/^emp_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const match = ctx.match as RegExpMatchArray;
    ctx.scene.session.employeeId = Number(match[1]); // ✅ Исправлен индекс
    ctx.scene.session.calendarMonth = format(new Date(), 'yyyy-MM');
    await ctx.editMessageText(
      'Выберите дату:',
      getCalendar(new Date(ctx.scene.session.calendarMonth + '-01'))
    );
    return ctx.wizard.next();
  } catch (e: any) {
    return ctx.scene.leave();
  }
});

/**
 * STEP 3 — Календарь
 */
const step3 = new Composer<MyContext>();
step3.action(/^month_(\d{4}-\d{2})$/, async (ctx) => {
  const match = ctx.match as RegExpMatchArray;
  ctx.scene.session.calendarMonth = match[1];
  await ctx.editMessageReplyMarkup(
    getCalendar(new Date(match[1] + '-01')).reply_markup
  );
  await ctx.answerCbQuery();
});

step3.action(/^date_(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const match = ctx.match as RegExpMatchArray;
    const selectedDate = match[1];
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
      buttons.push(slots.slice(i, i + 3).map((t: string) => Markup.button.callback(t, `time_${t}`)));
    }
    await ctx.editMessageText(`Свободное время на ${selectedDate}:`, Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  } catch (e: any) {
    return ctx.scene.leave();
  }
});

/**
 * STEP 4 — Выбор времени (Только по инлайн кнопкам!)
 */
const step4 = new Composer<MyContext>();
step4.action(/^time_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const match = ctx.match as RegExpMatchArray;
  ctx.scene.session.time = match[1];
  await ctx.reply(
    'Для завершения отправьте ваш номер телефона (нажмите кнопку):',
    Markup.keyboard([[Markup.button.contactRequest('📱 Отправить контакт')]]).oneTime().resize()
  );
  return ctx.wizard.next();
});

step4.on('text', async (ctx) => {
  const type = ctx.scene.session.serviceType;

  if (type === 'SERVICE') return;

  if (type === 'WORKSHOP') {
    return ctx.reply('Отправьте контакт через кнопку 👇');
  }

  return ctx.reply('Выберите время кнопкой выше 👆');
});

/**
 * STEP 5 — Ввод контакта и подтверждение данных (Сюда прыгают МК)
 */
const step5 = new Composer<MyContext>();
step5.on(['message', 'contact'], async (ctx) => {
  const phone = (ctx.message as any).contact?.phone_number || (ctx.message as any).text;

  if (!phone || phone.length < 7) {
    return ctx.reply('Введите корректный номер телефона');
  }

  ctx.scene.session.contact = phone;

  const service = await prisma.service.findUnique({
    where: { id: ctx.scene.session.serviceId }
  });

  if (!service) {
    await ctx.reply('Услуга не найдена');
    return ctx.scene.leave();
  }

  const isWorkshop = service.type === 'WORKSHOP';

  const msgText =
    `📝 *Информация о записи:*\n` +
    `🔹 *Тип:* ${getServiceTypeName(service.type)}\n` +
    `🔹 *Название:* ${service.name}\n` +
    (ctx.scene.session.date ? `📅 *Дата:* ${ctx.scene.session.date}\n` : '') +
    (ctx.scene.session.time ? `⏰ *Время:* ${ctx.scene.session.time}` : '');

  await ctx.reply('Проверьте данные:', Markup.removeKeyboard());

  await ctx.reply(msgText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Подтвердить', 'confirm')],
      [Markup.button.callback('❌ Отмена', 'cancel')]
    ])
  });

  return ctx.wizard.next();
});

/**
 * STEP 6 — Выбор кошелька (Alif, DC, Eschata)
 */
const step6 = new Composer<MyContext>();

step6.action('confirm', async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    '💳 Выберите способ оплаты:',
    Markup.inlineKeyboard([
      [Markup.button.callback('alif_mobi 🔸', 'pay_ALIF')],
      [Markup.button.callback('DC Wallet 💳', 'pay_DC')],
      [Markup.button.callback('Эсхата Онлайн 🔹', 'pay_ESCHATA')],
      [Markup.button.callback('❌ Отмена', 'cancel_pay')]
    ])
  );
});

step6.action(/^pay_(ALIF|DC|ESCHATA)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const provider = (ctx.match as RegExpMatchArray)[1] as any;
  const session = ctx.scene.session;

  const service = await prisma.service.findUnique({
    where: { id: session.serviceId }
  });

  if (!service?.price) {
    await ctx.reply('Ошибка стоимости услуги.');
    return ctx.scene.leave();
  }

  const invoice = await prisma.invoice.create({
    data: {
      botId: ctx.botId,
      telegramId: BigInt(ctx.from!.id),
      serviceId: session.serviceId!,
      employeeId: session.employeeId!,
      date: session.date!,
      time: session.time!,
      contact: session.contact!,
      amount: service.price,
      provider
    }
  });

  const paymentData = await paymentService.generateInvoice(
    provider,
    invoice.id,
    Number(service.price),
    `Оплата услуги: ${service.name}`
  );

  await ctx.deleteMessage().catch(() => {});

  await ctx.reply(
    `💸 Счёт создан!\n\n💰 ${service.price} TJS`,
    Markup.inlineKeyboard([
      [Markup.button.url('📱 Оплатить', paymentData.url)],
      [Markup.button.callback('❌ Отмена', 'cancel_pay')]
    ])
  );

  return ctx.scene.leave();
});

step6.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Запись отменена', mainButtons);
  return ctx.scene.leave();
});

step6.action('cancel_pay', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Запись отменена', mainButtons);
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
      .filter((c: any) => services.some((s: any) => s.type === c.id))
      .map((c: any) => [Markup.button.callback(c.label, `cat_${c.id}`)]);

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
