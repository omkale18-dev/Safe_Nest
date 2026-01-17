import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, Clock, Pill, AlertCircle, CheckCircle, X, Bell, RefreshCw } from 'lucide-react';
import { Medicine, MedicineLog } from '../types';

// Convert time string to minutes since midnight for comparison
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Check if two times are within a minimum gap (in minutes)
const areTimesTooClose = (time1: string, time2: string, minGapMinutes: number = 15): boolean => {
  const mins1 = timeToMinutes(time1);
  const mins2 = timeToMinutes(time2);
  return Math.abs(mins1 - mins2) < minGapMinutes;
};

// Check for time conflicts with existing medicines
const findTimeConflicts = (
  newTimes: string[],
  existingMedicines: Medicine[],
  editingId: string | null,
  minGapMinutes: number = 15
): { time: string; conflictWith: string }[] => {
  const conflicts: { time: string; conflictWith: string }[] = [];
  
  newTimes.forEach((newTime) => {
    existingMedicines.forEach((med) => {
      // Skip the medicine being edited
      if (med.id === editingId) return;
      
      med.times.forEach((existingTime) => {
        if (areTimesTooClose(newTime, existingTime, minGapMinutes)) {
          conflicts.push({
            time: newTime,
            conflictWith: `${med.name} at ${existingTime}`,
          });
        }
      });
    });
  });
  
  return conflicts;
};

interface MedicineManagerProps {
  medicines: Medicine[];
  onAddMedicine: (medicine: Medicine) => Promise<void>;
  onUpdateMedicine: (medicine: Medicine) => Promise<void>;
  onDeleteMedicine: (medicineId: string) => Promise<void>;
}

export const MedicineManager: React.FC<MedicineManagerProps> = ({
  medicines,
  onAddMedicine,
  onUpdateMedicine,
  onDeleteMedicine,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Medicine>>({
    name: '',
    dosage: '',
    frequency: 1,
    times: ['08:00'],
    timeLabels: ['Morning'],
    startDate: new Date(),
    isOngoing: true,
    instructions: '',
    doctorName: '',
    notes: '',
    totalQuantity: undefined,
    remainingQuantity: undefined,
    refillAlertThreshold: 7,
    voiceReminderEnabled: false,
    isCritical: false,
  });

  const timeOptions = [
    { value: '08:00', label: 'Breakfast (8:00 AM)' },
    { value: '12:00', label: 'Lunch (12:00 PM)' },
    { value: '20:00', label: 'Dinner (8:00 PM)' },
    { value: '14:00', label: 'Afternoon (2:00 PM)' },
  ];

  const handleAddTime = () => {
    if (formData.times && formData.times.length < 4) {
      setFormData({
        ...formData,
        times: [...formData.times, '08:00'],
        timeLabels: [...(formData.timeLabels || []), 'Morning'],
      });
    }
  };

  const handleRemoveTime = (index: number) => {
    const newTimes = formData.times?.filter((_, i) => i !== index) || [];
    const newLabels = formData.timeLabels?.filter((_, i) => i !== index) || [];
    setFormData({
      ...formData,
      times: newTimes,
      timeLabels: newLabels,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      alert('Please enter medicine name');
      return;
    }

    // Check for duplicate medicine name (case insensitive)
    const duplicateMed = medicines.find(
      (m) => m.name.toLowerCase().trim() === formData.name?.toLowerCase().trim() && m.id !== editingId
    );
    if (duplicateMed) {
      const proceed = confirm(
        `A medicine named "${duplicateMed.name}" already exists (${duplicateMed.dosage}, ${duplicateMed.times.join(', ')}).\n\nAre you sure you want to add another one?`
      );
      if (!proceed) return;
    }

    // Validate: check for duplicate times within this medicine
    const uniqueTimes = new Set(formData.times || []);
    if (uniqueTimes.size !== (formData.times || []).length) {
      alert('Duplicate times detected. Please use unique times for each dose.');
      return;
    }

    // Validate: check for time conflicts with other medicines
    const conflicts = findTimeConflicts(
      formData.times || [],
      medicines,
      editingId,
      15 // 15 minute minimum gap
    );
    
    if (conflicts.length > 0) {
      const conflictMsg = conflicts
        .map((c) => `${c.time} conflicts with ${c.conflictWith}`)
        .join('\n');
      const proceed = confirm(
        `Time conflicts detected:\n${conflictMsg}\n\nThis may cause confusion. Continue anyway?`
      );
      if (!proceed) return;
    }

    // Sync frequency with actual number of times
    const actualFrequency = (formData.times || ['08:00']).length;

    const medicine: Medicine = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      dosage: formData.dosage || '1 tablet',
      frequency: actualFrequency, // Auto-sync with times array
      times: formData.times || ['08:00'],
      timeLabels: formData.timeLabels,
      startDate: formData.startDate || new Date(),
      endDate: formData.isOngoing ? undefined : formData.endDate,
      durationDays: formData.durationDays,
      isOngoing: formData.isOngoing || true,
      instructions: formData.instructions || '',
      doctorName: formData.doctorName,
      notes: formData.notes,
      totalQuantity: formData.totalQuantity,
      remainingQuantity: formData.remainingQuantity ?? formData.totalQuantity,
      refillAlertThreshold: formData.refillAlertThreshold || 7,
      voiceReminderEnabled: formData.voiceReminderEnabled ?? false,
      isCritical: formData.isCritical ?? false,
      createdAt: editingId ? new Date(formData.createdAt!) : new Date(),
      updatedAt: new Date(),
    };

    if (editingId) {
      await onUpdateMedicine(medicine);
    } else {
      await onAddMedicine(medicine);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      dosage: '',
      frequency: 1,
      times: ['08:00'],
      timeLabels: ['Morning'],
      startDate: new Date(),
      isOngoing: true,
      instructions: '',
      doctorName: '',
      notes: '',
      totalQuantity: undefined,
      remainingQuantity: undefined,
      refillAlertThreshold: 7,
      voiceReminderEnabled: false,
      isCritical: false,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (medicine: Medicine) => {
    setFormData(medicine);
    setEditingId(medicine.id);
    setShowForm(true);
  };

  // Calculate refill status
  const getRefillStatus = (medicine: Medicine) => {
    if (!medicine.totalQuantity || !medicine.remainingQuantity) return null;
    
    const threshold = medicine.refillAlertThreshold || 7;
    const daysLeft = Math.floor(medicine.remainingQuantity / medicine.frequency);
    
    if (daysLeft <= 0) return { level: 'critical', text: 'Out of stock!', daysLeft: 0 };
    if (daysLeft <= threshold) return { level: 'warning', text: `${daysLeft} days supply left`, daysLeft };
    return { level: 'ok', text: `${daysLeft} days supply`, daysLeft };
  };

  const daysRemaining = (medicine: Medicine) => {
    if (medicine.isOngoing) return 'Ongoing';
    if (!medicine.endDate) return 'N/A';
    
    const today = new Date();
    const end = new Date(medicine.endDate);
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff <= 0) return 'Expired';
    if (diff === 1) return '1 day left';
    return `${diff} days left`;
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Medicines</h2>
          <p className="text-sm text-gray-600 mt-1">Manage daily medications</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="font-semibold">Add</span>
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{editingId ? 'Edit Medicine' : 'Add New Medicine'}</h3>
            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg">
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Medicine Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Medicine Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Aspirin, Metformin"
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Dosage */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Dosage *</label>
              <input
                type="text"
                value={formData.dosage || ''}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="e.g., 2 tablets, 5ml syrup"
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Frequency & Times */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Times per Day *</label>
              <div className="space-y-2">
                {formData.times?.map((time, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => {
                        const newTimes = [...(formData.times || [])];
                        newTimes[idx] = e.target.value;
                        setFormData({ ...formData, times: newTimes });
                      }}
                      className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                    {formData.times!.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTime(idx)}
                        className="p-2.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {formData.times && formData.times.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddTime}
                  className="mt-2 text-sm text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add another time
                </button>
              )}
            </div>

            {/* Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate ? formData.startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.isOngoing || false}
                    onChange={(e) => setFormData({ ...formData, isOngoing: e.target.checked })}
                    className="mr-2"
                  />
                  Ongoing Medicine
                </label>
              </div>
            </div>

            {!formData.isOngoing && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.endDate ? formData.endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Instructions */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Instructions</label>
              <textarea
                value={formData.instructions || ''}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="e.g., Take after food, with water"
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                rows={2}
              />
            </div>

            {/* Doctor Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor/Prescribed By</label>
              <input
                type="text"
                value={formData.doctorName || ''}
                onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                placeholder="Doctor's name (optional)"
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional information..."
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                rows={2}
              />
            </div>

            {/* Refill Tracking Section */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Pill size={18} className="text-blue-600" />
                Refill Tracking (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Quantity</label>
                  <input
                    type="number"
                    value={formData.totalQuantity || ''}
                    onChange={(e) => setFormData({ ...formData, totalQuantity: parseInt(e.target.value) || undefined })}
                    placeholder="30 pills"
                    min={1}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Remaining</label>
                  <input
                    type="number"
                    value={formData.remainingQuantity ?? formData.totalQuantity ?? ''}
                    onChange={(e) => setFormData({ ...formData, remainingQuantity: parseInt(e.target.value) || undefined })}
                    placeholder="30"
                    min={0}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alert when less than (days supply)</label>
                <input
                  type="number"
                  value={formData.refillAlertThreshold || 7}
                  onChange={(e) => setFormData({ ...formData, refillAlertThreshold: parseInt(e.target.value) || 7 })}
                  min={1}
                  max={30}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Options Section */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-3">Reminder Options</h4>
              <div className="space-y-3">
                {/* Critical Medicine Toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-red-500" />
                    <span className="text-sm font-medium text-gray-700">Critical Medicine</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isCritical || false}
                    onChange={(e) => setFormData({ ...formData, isCritical: e.target.checked })}
                    className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                  />
                </label>
                <p className="text-xs text-gray-500 ml-6">Missing this medicine will trigger a louder alert</p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md"
              >
                {editingId ? 'Update' : 'Add'} Medicine
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Medicines List */}
      {medicines.length === 0 ? (
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-8 text-center border border-blue-100">
          <Pill size={48} className="mx-auto mb-4 text-blue-400" />
          <p className="text-gray-600 font-semibold">No medicines added yet</p>
          <p className="text-sm text-gray-500 mt-1">Add medicines to track daily intake</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medicines.map((medicine) => (
            <div
              key={medicine.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="p-3 bg-purple-100 rounded-xl flex-shrink-0">
                  <Pill size={24} className="text-purple-600" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{medicine.name}</h3>
                      <p className="text-sm text-gray-600">{medicine.dosage}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(medicine)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${medicine.name}?`)) {
                            onDeleteMedicine(medicine.id);
                          }
                        }}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Times */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Clock size={16} className="text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 font-semibold">
                      {medicine.times.join(', ')}
                    </span>
                  </div>

                  {/* Badges Row */}
                  <div className="flex gap-2 flex-wrap mb-2">
                    {medicine.isCritical && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        <AlertCircle size={12} />
                        Critical
                      </span>
                    )}
                  </div>

                  {/* Refill Alert */}
                  {(() => {
                    const refillStatus = getRefillStatus(medicine);
                    if (!refillStatus) return null;
                    
                    return (
                      <div className={`flex items-center justify-between gap-2 p-2 rounded-lg mb-2 ${
                        refillStatus.level === 'critical' 
                          ? 'bg-red-100 border border-red-200' 
                          : refillStatus.level === 'warning'
                            ? 'bg-yellow-100 border border-yellow-200'
                            : 'bg-green-50 border border-green-100'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Pill size={14} className={
                            refillStatus.level === 'critical' 
                              ? 'text-red-600' 
                              : refillStatus.level === 'warning'
                                ? 'text-yellow-600'
                                : 'text-green-600'
                          } />
                          <span className={`text-xs font-bold ${
                            refillStatus.level === 'critical' 
                              ? 'text-red-700' 
                              : refillStatus.level === 'warning'
                                ? 'text-yellow-700'
                                : 'text-green-700'
                          }`}>
                            {refillStatus.text}
                            {refillStatus.level !== 'ok' && ' - Order refill!'}
                          </span>
                        </div>
                        {medicine.totalQuantity && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Refill: reset remaining to total
                              onUpdateMedicine({
                                ...medicine,
                                remainingQuantity: medicine.totalQuantity
                              });
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <RefreshCw size={12} />
                            Refill
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Duration */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={16} className="text-gray-500 flex-shrink-0" />
                    <span>{daysRemaining(medicine)}</span>
                  </div>

                  {/* Instructions */}
                  {medicine.instructions && (
                    <p className="text-sm text-gray-600 mt-2 italic">
                      {medicine.instructions}
                    </p>
                  )}

                  {/* Doctor Name */}
                  {medicine.doctorName && (
                    <p className="text-xs text-gray-500 mt-1">
                      👨‍⚕️ Prescribed by: {medicine.doctorName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
