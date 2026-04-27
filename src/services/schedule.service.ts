import { prisma } from '../db/client';
import { parseDateStr } from '../utils/date.utils';

const timeToMinutes = (time: string): number => {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + mm;
};

const minutesToTime = (totalMinutes: number): string => {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const isOverlapping = (s1: number, e1: number, s2: number, e2: number): boolean => {
  return s1 < e2 && e1 > s2;
};

export async function getFreeSlots(
  botId: number,
  employeeId: number,
  serviceId: number,
  dateStr: string
): Promise<string[]> {
  const service = await prisma.service.findFirst({ where: { id: serviceId, botId } });
  if (!service) return [];

  const duration = service.durationMinutes;
  const maxCapacity = (service as any).maxCapacity || 1; 

  const date = parseDateStr(dateStr);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
  const schedule = await prisma.workSchedule.findFirst({
    where: { employeeId, dayOfWeek, botId }
  });
  if (!schedule) return [];

  const workStart = timeToMinutes(schedule.startTime);
  const workEnd = timeToMinutes(schedule.endTime);

  const scheduledEvents = await prisma.service.findMany({
    where: {
      botId,
      eventDate: { gte: startOfDay, lte: endOfDay },
      employeeServices: { some: { employeeId } },
      type: { not: 'SERVICE' }
    }
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      botId,
      employeeId,
      appointmentDate: { gte: startOfDay, lte: endOfDay },
      status: { not: 'CANCELLED' }
    }
  });

  const availableSlots: string[] = [];
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const STEP = 30;

  for (let slotStart = workStart; slotStart + duration <= workEnd; slotStart += STEP) {
    const slotEnd = slotStart + duration;
    if (isToday && slotStart < currentMinutes) continue;

    const otherEvent = scheduledEvents.find(e => {
      if (!e.startTime) return false;
      const eventStart = timeToMinutes(e.startTime);
      const eventEnd = eventStart + e.durationMinutes;
      return isOverlapping(slotStart, slotEnd, eventStart, eventEnd);
    });

    const overlappingApps = appointments.filter(app => {
      const appStart = timeToMinutes(app.startTime);
      const appEnd = timeToMinutes(app.endTime);
      return isOverlapping(slotStart, slotEnd, appStart, appEnd);
    });

    if (otherEvent) {
      if (otherEvent.id === serviceId && overlappingApps.length < maxCapacity) {
        availableSlots.push(minutesToTime(slotStart));
      }
    } else {
      if (overlappingApps.length === 0) {
        availableSlots.push(minutesToTime(slotStart));
      }
    }
  }

  return availableSlots;
}