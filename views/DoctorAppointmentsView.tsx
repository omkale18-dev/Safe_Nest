import React, { useState } from 'react';
import { 
  Calendar, Clock, Plus, MapPin, Phone, User, 
  ChevronLeft, Stethoscope, CheckCircle, XCircle, AlertCircle, Edit2, Trash2
} from 'lucide-react';
import { DoctorAppointment } from '../types';

interface DoctorAppointmentsViewProps {
  appointments: DoctorAppointment[];
  onAddAppointment: (appointment: Omit<DoctorAppointment, 'id' | 'createdAt'>) => void;
  onUpdateAppointment: (id: string, updates: Partial<DoctorAppointment>) => void;
  onDeleteAppointment: (id: string) => void;
  onBack?: () => void;
  userRole: 'senior' | 'caregiver';
}

export const DoctorAppointmentsView: React.FC<DoctorAppointmentsViewProps> = ({
  appointments,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  onBack,
  userRole = 'senior'
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderBefore, setReminderBefore] = useState(60);

  const resetForm = () => {
    setDoctorName('');
    setSpecialty('');
    setHospitalName('');
    setAddress('');
    setPhone('');
    setDate('');
    setTime('');
    setPurpose('');
    setNotes('');
    setReminderBefore(60);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!doctorName || !date || !time) return;

    // Parse date properly - date input gives "YYYY-MM-DD", create date at noon to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const appointmentDate = new Date(year, month - 1, day, 12, 0, 0); // Month is 0-indexed

    // Use empty strings instead of undefined (Firebase doesn't allow undefined)
    const appointmentData: Omit<DoctorAppointment, 'id' | 'createdAt'> = {
      doctorName,
      specialty: specialty || '',
      hospitalName: hospitalName || '',
      address: address || '',
      phone: phone || '',
      date: appointmentDate,
      time,
      purpose: purpose || '',
      notes: notes || '',
      reminderBefore,
      status: 'UPCOMING',
      createdBy: userRole,
    };

    if (editingId) {
      onUpdateAppointment(editingId, appointmentData);
    } else {
      onAddAppointment(appointmentData);
    }

    resetForm();
    setShowAddModal(false);
  };

  const handleEdit = (apt: DoctorAppointment) => {
    setEditingId(apt.id);
    setDoctorName(apt.doctorName);
    setSpecialty(apt.specialty || '');
    setHospitalName(apt.hospitalName || '');
    setAddress(apt.address || '');
    setPhone(apt.phone || '');
    setDate(new Date(apt.date).toISOString().split('T')[0]);
    setTime(apt.time);
    setPurpose(apt.purpose || '');
    setNotes(apt.notes || '');
    setReminderBefore(apt.reminderBefore);
    setShowAddModal(true);
  };

  const markCompleted = (id: string) => {
    onUpdateAppointment(id, { status: 'COMPLETED' });
  };

  const markMissed = (id: string) => {
    onUpdateAppointment(id, { status: 'MISSED' });
  };

  const formatDate = (date: Date | any) => {
    // Handle Firebase timestamp or Date object
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'object' && 'seconds' in date) {
      // Firebase Timestamp
      dateObj = new Date(date.seconds * 1000);
    } else {
      dateObj = new Date(date);
    }
    
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    const [hours, mins] = time.split(':');
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${mins} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const isUpcoming = (apt: DoctorAppointment) => {
    // Handle Firebase timestamp or Date object
    let aptDate: Date;
    if (apt.date instanceof Date) {
      aptDate = new Date(apt.date);
    } else if (typeof apt.date === 'object' && 'seconds' in (apt.date as any)) {
      // Firebase Timestamp
      aptDate = new Date((apt.date as any).seconds * 1000);
    } else {
      aptDate = new Date(apt.date);
    }
    
    const [hours, mins] = apt.time.split(':').map(Number);
    aptDate.setHours(hours, mins, 0, 0);
    
    const now = new Date();
    
    // If status is not UPCOMING, it's not upcoming
    if (apt.status !== 'UPCOMING') return false;
    
    // Compare with current time - appointment is upcoming if it's in the future
    return aptDate.getTime() >= now.getTime();
  };

  const isPast = (apt: DoctorAppointment) => {
    // Handle Firebase timestamp or Date object
    let aptDate: Date;
    if (apt.date instanceof Date) {
      aptDate = new Date(apt.date);
    } else if (typeof apt.date === 'object' && 'seconds' in (apt.date as any)) {
      // Firebase Timestamp
      aptDate = new Date((apt.date as any).seconds * 1000);
    } else {
      aptDate = new Date(apt.date);
    }
    
    const [hours, mins] = apt.time.split(':').map(Number);
    aptDate.setHours(hours, mins, 0, 0);
    
    const now = new Date();
    
    // If status is not UPCOMING (completed, missed, cancelled), show in past
    if (apt.status !== 'UPCOMING') return true;
    
    // If the appointment time has passed, it's past
    return aptDate.getTime() < now.getTime();
  };

  const upcomingAppointments = appointments
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const pastAppointments = appointments
    .filter(isPast)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'CANCELLED': return 'bg-gray-100 text-gray-700';
      case 'MISSED': return 'bg-red-100 text-red-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle size={16} className="text-green-600" />;
      case 'MISSED': return <XCircle size={16} className="text-red-600" />;
      default: return <AlertCircle size={16} className="text-blue-600" />;
    }
  };

  // Common specialties for quick selection
  const commonSpecialties = [
    'General Physician', 'Cardiologist', 'Diabetologist', 'Orthopedic',
    'Neurologist', 'Eye Specialist', 'ENT', 'Dentist', 'Dermatologist'
  ];

  return (
    <div className="pb-24 pt-6 px-4 min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 rounded-lg bg-white shadow-sm">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Doctor Appointments</h1>
          <p className="text-sm text-gray-500">{upcomingAppointments.length} upcoming</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="p-3 rounded-full bg-teal-500 text-white shadow-lg"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcomingAppointments.map(apt => (
              <div key={apt.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                        <Stethoscope size={24} className="text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{apt.doctorName}</h3>
                        {apt.specialty && (
                          <p className="text-sm text-teal-600">{apt.specialty}</p>
                        )}
                        {apt.purpose && (
                          <p className="text-sm text-gray-500 mt-1">{apt.purpose}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEdit(apt)}
                        className="p-2 rounded-lg hover:bg-gray-100"
                      >
                        <Edit2 size={16} className="text-gray-400" />
                      </button>
                      <button 
                        onClick={() => onDeleteAppointment(apt.id)}
                        className="p-2 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Calendar size={14} />
                      {formatDate(apt.date)}
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock size={14} />
                      {formatTime(apt.time)}
                    </div>
                  </div>

                  {apt.hospitalName && (
                    <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={14} />
                      {apt.hospitalName}
                    </div>
                  )}

                  {apt.phone && (
                    <a 
                      href={`tel:${apt.phone}`}
                      className="mt-2 flex items-center gap-1 text-sm text-blue-600"
                    >
                      <Phone size={14} />
                      {apt.phone}
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-gray-100 p-3 bg-gray-50 flex gap-2">
                  <button
                    onClick={() => markCompleted(apt.id)}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1"
                  >
                    <CheckCircle size={16} />
                    Mark Completed
                  </button>
                  <button
                    onClick={() => markMissed(apt.id)}
                    className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg"
                  >
                    Missed
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingAppointments.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center mb-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={32} className="text-gray-400" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">No Upcoming Appointments</h3>
          <p className="text-sm text-gray-500">Tap + to add a new appointment</p>
        </div>
      )}

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase mb-3">Past</h2>
          <div className="space-y-2">
            {pastAppointments.slice(0, 10).map(apt => (
              <div key={apt.id} className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(apt.status)}
                    <div>
                      <p className="font-medium text-gray-900">{apt.doctorName}</p>
                      <p className="text-xs text-gray-500">{formatDate(apt.date)}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(apt.status)}`}>
                    {apt.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4 pb-24">
          <div className="bg-white w-full max-w-md rounded-t-3xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold">
                {editingId ? 'Edit Appointment' : 'Add Appointment'}
              </h2>
              <button onClick={() => { resetForm(); setShowAddModal(false); }} className="text-gray-400 text-2xl">&times;</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Doctor Name *</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Dr. Sharma"
                  className="w-full p-3 border rounded-xl mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Specialty</label>
                <div className="flex flex-wrap gap-2 mt-1 mb-2">
                  {commonSpecialties.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setSpecialty(spec)}
                      className={`px-3 py-1 rounded-full text-xs ${
                        specialty === spec 
                          ? 'bg-teal-500 text-white' 
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Or type specialty"
                  className="w-full p-3 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 border rounded-xl mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Time *</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full p-3 border rounded-xl mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Hospital/Clinic Name</label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="City Hospital"
                  className="w-full p-3 border rounded-xl mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123, Main Road, City"
                  className="w-full p-3 border rounded-xl mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Doctor's Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full p-3 border rounded-xl mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Purpose/Reason</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Follow-up, Blood Test, Routine Checkup"
                  className="w-full p-3 border rounded-xl mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Remind Me Before</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { value: 30, label: '30 min' },
                    { value: 60, label: '1 hour' },
                    { value: 120, label: '2 hours' },
                    { value: 1440, label: '1 day' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReminderBefore(opt.value)}
                      className={`flex-1 py-2 rounded-lg text-sm ${
                        reminderBefore === opt.value 
                          ? 'bg-teal-500 text-white' 
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bring reports, fasting required, etc."
                  className="w-full p-3 border rounded-xl mt-1"
                  rows={2}
                />
              </div>

              </div>
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0 safe-area-inset-bottom">
              <button
                onClick={handleSubmit}
                disabled={!doctorName || !date || !time}
                className="w-full py-3 bg-teal-500 text-white font-bold rounded-lg disabled:opacity-50 hover:bg-teal-600 transition-colors"
              >
                {editingId ? 'Update Appointment' : 'Add Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
