import { Context, Scenes } from 'telegraf';

export interface MyWizardSession extends Scenes.WizardSessionData {
  serviceId?: number;
  employeeId?: number;
  date?: string;
  time?: string;
  contact?: string;
  calendarMonth?: string;

  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  selectedDays?: number[];
  selectedServices?: number[];
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  dayOfWeek?: number;
  action?: string;

  tempToken?: string;
  tempAdminId?: number;
  type?: 'SERVICE' | 'TRAINING' | 'WORKSHOP' | 'COURSE';
  maxCapacity?: number;
  serviceType?: string;
}

export interface MyContext extends Context {
  botId: number;
  session: Scenes.WizardSession<MyWizardSession>;
  scene: Scenes.SceneContextScene<MyContext, MyWizardSession>;
  wizard: Scenes.WizardContextWizard<MyContext>;
}
