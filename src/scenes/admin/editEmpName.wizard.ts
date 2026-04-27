import { Scenes } from 'telegraf';
import { MyContext } from '../../types';
import { adminService } from '../../services/admin.service';

export const editEmpNameWizard = new Scenes.WizardScene<MyContext>(
  'edit_emp_name_wizard',
  async (ctx) => {
    const state = ctx.scene.state as { employeeId?: number };
    if (state.employeeId) {
      ctx.scene.session.employeeId = state.employeeId;
    }

    await ctx.reply('Введите новое имя сотрудника:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const newName = (ctx.message as any)?.text;
    const id = ctx.scene.session.employeeId;

    if (newName && id) {
      await adminService.updateEmployeeName(ctx.botId, id, newName);
      await ctx.reply(`✅ Имя успешно изменено на: ${newName}`);
    } else {
      await ctx.reply('❌ Ошибка: не удалось получить данные для обновления.');
    }

    return ctx.scene.enter('manage_employees_scene');
  }
);