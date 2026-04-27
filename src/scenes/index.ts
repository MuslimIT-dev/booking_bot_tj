import { Scenes } from 'telegraf';
import { MyContext } from '../types'; 

import { bookingWizard } from './booking.wizard';
import { adminMenuScene } from './admin/adminMenu.scene';
import { addEmployeeWizard } from './admin/addEmployee.wizard';
import { addScheduleWizard } from './admin/addSchedule.wizard';
import { viewAppointmentsScene } from './admin/viewAppointments.scene';
import { manageEmployeesScene } from './admin/manageEmployees.scene';
import { editEmpNameWizard } from './admin/editEmpName.wizard'; 
import { editEmpServicesWizard } from './admin/editEmpServices.wizard';
import { manageServicesScene } from './admin/manageServices.wizard';
import { addServiceWizard } from './admin/addService.wizard';

export const stage = new Scenes.Stage<MyContext>([
  bookingWizard,
  adminMenuScene,
  addEmployeeWizard,
  addScheduleWizard,
  viewAppointmentsScene,
  manageEmployeesScene,
  editEmpNameWizard,
  editEmpServicesWizard,
  manageServicesScene,
  addServiceWizard
]);
