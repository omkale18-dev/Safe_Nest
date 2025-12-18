import React from 'react';
import { Phone, Plus, User, ShieldCheck } from 'lucide-react';
import { HouseholdMember, Contact, UserRole } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface ContactsViewProps {
  caregivers?: HouseholdMember[];
  contacts?: Contact[];
  onAddContact?: (contact: Contact) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ caregivers = [], contacts = [], onAddContact }) => {
  const { t } = useLanguage();

  const handleCall = (phoneNumber: string) => {
    // Sanitize phone number to keep only digits and +
    const sanitizedNumber = phoneNumber.replace(/[^0-9+]/g, '');
    window.open(`tel:${sanitizedNumber}`, '_self');
  };

  const primaryCaregiver = caregivers.find(c => c.role === UserRole.CAREGIVER);
  const allCaregivers = caregivers.filter(c => c.role === UserRole.CAREGIVER);

  return (
    <div className="pb-24 pt-6 px-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{t.safetyNetwork}</h1>
        
      </div>

      {allCaregivers.length > 0 && (
        <div className="bg-blue-600 text-white p-4 rounded-xl shadow-lg shadow-blue-200">
          <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="text-blue-200" size={24} />
              <h3 className="font-bold text-lg">{t.caregiversHeading}</h3>
          </div>
          <p className="text-blue-100 text-sm mb-4">{t.caregiversSubtext}</p>
          
          <div className="space-y-2">
            {allCaregivers.map((caregiver, idx) => (
              <div key={caregiver.id} className="bg-white/10 p-3 rounded-lg flex items-center gap-3 backdrop-blur-sm border border-white/10">
                <img src={caregiver.avatar} alt={caregiver.name} className="w-12 h-12 rounded-full border-2 border-white/20" />
                <div className="flex-1">
                    <p className="font-bold">{caregiver.name}</p>
                    <p className="text-xs text-blue-200">{idx === 0 ? t.primary : t.secondary}</p>
                    <p className="text-xs text-blue-200 mt-0.5">{caregiver.phone}</p>
                </div>
                <button 
                    onClick={() => handleCall(caregiver.phone)}
                    className="p-2 bg-white text-blue-600 rounded-full hover:bg-blue-50 transition-colors active:scale-95"
                >
                    <Phone size={16} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{t.otherContacts}</h2>
        <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                {contact.avatar ? (
                  <img src={contact.avatar} alt={contact.name} className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <User size={24} />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{contact.name}</p>
                  {contact.relationship && <p className="text-xs text-gray-500">{contact.relationship}</p>}
                </div>
                <button 
                  onClick={() => handleCall(contact.phone)}
                  className="p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-green-50 hover:text-green-600 transition-colors active:scale-95"
                >
                  <Phone size={16} />
                </button>
              </div>
            ))}

        </div>
      </div>
    </div>
  );
};