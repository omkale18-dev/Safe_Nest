import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Medicine } from '../types';

/**
 * Simple Medicine Notification Service
 * Shows notifications at scheduled medicine times using LocalNotifications
 * No background alarms or exact alarm permissions required
 */
class MedicineNotificationService {
  private notificationIdBase = 100000; // Base ID for medicine notifications

  /**
   * Check if notifications are available
   */
  isAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('[MedicineNotifications] Permission request failed:', error);
      return false;
    }
  }

  /**
   * Schedule notifications for a medicine
   */
  async scheduleMedicineNotifications(medicine: Medicine): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // Request permissions if needed
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('[MedicineNotifications] No notification permission');
        return;
      }

      // Cancel existing notifications for this medicine
      await this.cancelMedicineNotifications(medicine.id);

      // Schedule notifications for each time
      const notifications = medicine.times.map((time, index) => {
        const [hours, minutes] = time.split(':').map(Number);
        const schedule = new Date();
        schedule.setHours(hours, minutes, 0, 0);

        // If time has passed today, schedule for tomorrow
        if (schedule.getTime() < Date.now()) {
          schedule.setDate(schedule.getDate() + 1);
        }

        const notificationId = this.notificationIdBase + parseInt(medicine.id) + index;
        const timeLabel = medicine.timeLabels?.[index] || time;

        return {
          id: notificationId,
          title: `💊 Time for ${medicine.name}`,
          body: `${timeLabel} - ${medicine.dosage}\n${medicine.instructions || 'Take as prescribed'}`,
          schedule: {
            at: schedule,
            repeats: true,
            every: 'day' as const,
          },
          sound: 'default',
          channelId: 'medicine_reminders',
          smallIcon: 'ic_stat_name',
        };
      });

      await LocalNotifications.schedule({ notifications });
      console.log('[MedicineNotifications] Scheduled', notifications.length, 'notifications for', medicine.name);
    } catch (error) {
      console.error('[MedicineNotifications] Failed to schedule:', error);
    }
  }

  /**
   * Cancel all notifications for a specific medicine
   */
  async cancelMedicineNotifications(medicineId: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // Cancel up to 10 possible notification IDs for this medicine
      const idsToCancel = [];
      for (let i = 0; i < 10; i++) {
        idsToCancel.push(this.notificationIdBase + parseInt(medicineId) + i);
      }

      await LocalNotifications.cancel({ notifications: idsToCancel.map(id => ({ id })) });
      console.log('[MedicineNotifications] Cancelled notifications for medicine', medicineId);
    } catch (error) {
      console.error('[MedicineNotifications] Failed to cancel:', error);
    }
  }

  /**
   * Schedule notifications for all medicines
   */
  async scheduleAllMedicines(medicines: Medicine[]): Promise<void> {
    console.log('[MedicineNotifications] Scheduling notifications for', medicines.length, 'medicines');
    
    for (const medicine of medicines) {
      await this.scheduleMedicineNotifications(medicine);
    }
  }

  /**
   * Cancel all medicine notifications
   */
  async cancelAllNotifications(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // Get all pending notifications
      const pending = await LocalNotifications.getPending();
      
      // Filter medicine notification IDs (>= notificationIdBase)
      const medicineNotifications = pending.notifications.filter(
        n => n.id >= this.notificationIdBase
      );

      if (medicineNotifications.length > 0) {
        await LocalNotifications.cancel({ 
          notifications: medicineNotifications.map(n => ({ id: n.id })) 
        });
        console.log('[MedicineNotifications] Cancelled', medicineNotifications.length, 'notifications');
      }
    } catch (error) {
      console.error('[MedicineNotifications] Failed to cancel all:', error);
    }
  }
}

export const medicineNotifications = new MedicineNotificationService();
