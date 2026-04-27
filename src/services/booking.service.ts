import { prisma } from '../db/client';

export const bookingService = {
  async getServices(botId: number) {
    return prisma.service.findMany({
      where: { botId, isActive: true }
    });
  },

  async getEmployeesByService(botId: number, serviceId: number) {
    return prisma.employee.findMany({
      where: {
        botId,
        isActive: true,
        employeeServices: {
          some: { serviceId }
        }
      }
    });
  },

  async getClientAppointments(botId: number, telegramId: number) {
    return prisma.appointment.findMany({
      where: {
        botId: botId,
        client: {
          telegramId: BigInt(telegramId),
          botId: botId
        }
      },
      include: { service: true, employee: true },
      orderBy: { appointmentDate: 'asc' }
    });
  },

  async createAppointment(botId: number, data: any) {
    const user = await prisma.user.upsert({
      where: {
        telegramId_botId: {
          telegramId: BigInt(data.telegramId),
          botId
        }
      },
      update: {
        phone: data.contact
      },
      create: {
        telegramId: BigInt(data.telegramId),
        phone: data.contact,
        botId
      }
    });

    const service = await prisma.service.findFirstOrThrow({
      where: { id: data.serviceId, botId }
    });

    const [h, m] = data.time.split(':').map(Number);
    const endMins = h * 60 + m + service.durationMinutes;
    const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

    const appointmentDate = new Date(data.date);

    const conflict = await prisma.appointment.findFirst({
      where: {
        botId,
        employeeId: data.employeeId,
        appointmentDate,
        status: { not: 'CANCELLED' },
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: data.time } }
        ]
      }
    });

    if (conflict) throw new Error('TIME_TAKEN');

    return prisma.appointment.create({
      data: {
        botId,
        clientUserId: user.id,
        serviceId: data.serviceId,
        employeeId: data.employeeId,
        appointmentDate,
        startTime: data.time,
        endTime,
        clientContact: data.contact
      }
    });
  }
};
