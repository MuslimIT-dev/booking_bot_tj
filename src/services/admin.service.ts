import { prisma } from '../db/client';

export const adminService = {
async createService(
  botId: number, 
  name: string, 
  durationMinutes: number, 
  price: number, 
  type: string = 'SERVICE', 
  maxCapacity: number = 1,
  eventDate?: Date,
  startTime?: string
) {
  return prisma.service.create({ 
    data: { 
      botId, 
      name, 
      durationMinutes, 
      price, 
      type: type as any, 
      maxCapacity,
      eventDate,
      startTime
    } 
  });
},

  async getAllServices(botId: number) {
    return prisma.service.findMany({ 
      where: { botId, isActive: true }, 
      orderBy: { name: 'asc' } 
    });
  },

  async getServiceById(botId: number, id: number) {
    return prisma.service.findFirst({
      where: { id, botId }
    });
  },

  async deleteService(botId: number, id: number) {
    return prisma.service.update({
      where: { id },
      data: { isActive: false }
    });
  },

  // --- EMPLOYEES ---
  async getAllEmployees(botId: number) {
    return prisma.employee.findMany({
      where: { botId, isActive: true },
      include: { employeeServices: { include: { service: true } } },
      orderBy: { name: 'asc' }
    });
  },

  async getEmployeeById(botId: number, id: number) {
    return prisma.employee.findFirst({
      where: { id, botId },
      include: { employeeServices: { include: { service: true } } }
    });
  },

  async createEmployee(botId: number, name: string, serviceIds: number[]) {
    return prisma.employee.create({
      data: {
        botId,
        name,
        employeeServices: { 
          create: serviceIds.map(id => ({ 
            serviceId: id,
            botId: botId 
          })) 
        }
      }
    });
  },

  async updateEmployeeName(botId: number, id: number, name: string) {
    return prisma.employee.update({ 
      where: { id }, 
      data: { name } 
    });
  },

  async updateEmployeeServices(botId: number, employeeId: number, serviceIds: number[]) {
    await prisma.employeeService.deleteMany({ where: { employeeId, botId } });
    
    if (serviceIds.length > 0) {
      await prisma.employeeService.createMany({
        data: serviceIds.map(serviceId => ({ 
          employeeId, 
          serviceId, 
          botId 
        }))
      });
    }
  },

  async deleteEmployee(botId: number, id: number) {
    return prisma.employee.update({ 
      where: { id }, 
      data: { isActive: false } 
    });
  },

  // --- SCHEDULE ---
  async setMassWorkSchedule(
    botId: number,
    employeeId: number, 
    days: number[], 
    startTime: string, 
    endTime: string, 
    breakStart?: string, 
    breakEnd?: string
  ) {
    const bStart = breakStart || null;
    const bEnd = breakEnd || null;

    return prisma.$transaction(async (tx) => {
      await tx.workSchedule.deleteMany({
        where: {
          botId,
          employeeId,
          dayOfWeek: { in: days }
        }
      });

      return tx.workSchedule.createMany({
        data: days.map(dayOfWeek => ({
          botId,
          employeeId,
          dayOfWeek,
          startTime,
          endTime,
          breakStart: bStart,
          breakEnd: bEnd
        }))
      });
    });
  },

  // --- APPOINTMENTS ---
  async getAllAppointments(botId: number) {
    return prisma.appointment.findMany({
      where: {
        botId,
        status: { not: 'CANCELLED' }
      },
      include: { service: true, employee: true, client: true },
      orderBy: { appointmentDate: 'desc' },
      take: 50 
    });
  }
};
