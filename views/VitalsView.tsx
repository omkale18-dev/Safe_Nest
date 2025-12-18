import React from 'react';
import { Heart, Droplet, CheckCircle, HelpCircle, Activity, RefreshCw, Moon, Thermometer, Gauge } from 'lucide-react';
import { SeniorStatus } from '../types';

interface VitalsViewProps {
  status: SeniorStatus;
}

export const VitalsView: React.FC<VitalsViewProps> = ({ status }) => {
  return (
    <div className="pb-24 pt-6 px-4 space-y-4 animate-fade-in bg-gray-50 min-h-full">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-black text-gray-900">Vitals</h1>
        <button className="text-gray-400 hover:text-gray-600">
           <HelpCircle size={24} />
        </button>
      </div>

      {/* Sync Status */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="bg-green-100 rounded-full p-1">
                <CheckCircle size={16} className="text-green-500" />
            </div>
            <span className="text-sm text-gray-600 font-medium">Synced with Google Fit • Just now</span>
         </div>
         <button className="text-blue-600 text-sm font-bold hover:underline">Sync</button>
      </div>

      {/* Heart Rate Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                      <Heart className="text-red-500" size={24} fill="currentColor" />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Heart Rate</h3>
                      <p className="text-gray-500 text-sm">Resting</p>
                  </div>
              </div>
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Normal</span>
          </div>

          <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-black text-gray-900">{status.heartRate}</span>
              <span className="text-gray-500 font-bold mb-1">BPM</span>
          </div>

          <div className="space-y-2">
              <div className="flex items-end justify-between h-12 gap-1 px-1">
                  {[40, 60, 45, 70, 50, 80, 65, 55, 75, 60, 85, 50].map((h, i) => (
                      <div key={i} style={{ height: `${h}%` }} className={`w-full rounded-t-sm ${i > 7 ? 'bg-red-200' : 'bg-red-50'}`}></div>
                  ))}
              </div>
              <p className="text-xs text-gray-400 font-medium">Last 4 hours</p>
          </div>
      </div>

      {/* Blood Pressure Card (New) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                      <Gauge className="text-orange-500" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Blood Pressure</h3>
                      <p className="text-gray-500 text-sm">Last checked 8am</p>
                  </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.bloodPressureSys > 140 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {status.bloodPressureSys > 140 ? 'Elevated' : 'Normal'}
              </span>
          </div>

          <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-black text-gray-900">{status.bloodPressureSys}</span>
              <span className="text-3xl text-gray-400 font-light">/</span>
              <span className="text-4xl font-bold text-gray-700">{status.bloodPressureDia}</span>
              <span className="text-gray-500 font-bold mb-1">mmHg</span>
          </div>
          
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex relative">
              <div className="w-1/3 h-full bg-green-400"></div>
              <div className="w-1/3 h-full bg-yellow-400"></div>
              <div className="w-1/3 h-full bg-red-400"></div>
              {/* Indicator */}
              <div className="absolute top-0 bottom-0 w-1 bg-black" style={{ left: '45%' }}></div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-medium uppercase">
              <span>Low</span>
              <span>Normal</span>
              <span>High</span>
          </div>
      </div>

      {/* Blood Oxygen Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                      <Droplet className="text-blue-500" size={24} fill="currentColor" />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Blood Oxygen</h3>
                      <p className="text-gray-500 text-sm">SpO₂</p>
                  </div>
              </div>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">Excellent</span>
          </div>

          <div className="flex items-end gap-1 mb-6">
              <span className="text-5xl font-black text-gray-900">{status.spo2}</span>
              <span className="text-2xl font-bold text-gray-400 mb-1">%</span>
          </div>

          <div className="relative pt-1">
            <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-blue-100">
                <div style={{ width: `${status.spo2}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
            </div>
          </div>
      </div>

      {/* Sleep Quality Card (New) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
                      <Moon className="text-indigo-500" size={24} fill="currentColor" />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Sleep</h3>
                      <p className="text-gray-500 text-sm">Last Night</p>
                  </div>
              </div>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">Score: {status.sleepScore}</span>
          </div>

          <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-black text-gray-900">{Math.floor(status.sleepHours)}</span>
              <span className="text-gray-500 font-bold mb-1">hr</span>
              <span className="text-5xl font-black text-gray-900">{Math.round((status.sleepHours % 1) * 60)}</span>
              <span className="text-gray-500 font-bold mb-1">min</span>
          </div>

          {/* Sleep Stages Bar */}
          <div className="flex w-full h-4 rounded-full overflow-hidden mb-2">
              <div className="w-[50%] bg-indigo-500 h-full"></div> {/* Light */}
              <div className="w-[30%] bg-purple-600 h-full"></div> {/* Deep */}
              <div className="w-[20%] bg-indigo-200 h-full"></div> {/* REM/Awake */}
          </div>
          <div className="flex gap-4 text-xs text-gray-500 font-medium">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Light</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-600"></div> Deep</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-200"></div> REM</div>
          </div>
      </div>

      {/* Body Temperature (New) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
                      <Thermometer className="text-yellow-500" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Body Temp</h3>
                      <p className="text-gray-500 text-sm">Skin Temp</p>
                  </div>
              </div>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">Normal</span>
          </div>

          <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-black text-gray-900">{status.bodyTemp}</span>
              <span className="text-gray-500 font-bold mb-1">°F</span>
          </div>
      </div>

       {/* Daily Steps Card */}
       <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center">
                      <Activity className="text-teal-500" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Daily Steps</h3>
                      <p className="text-gray-500 text-sm">Activity</p>
                  </div>
              </div>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">Goal: 5k</span>
          </div>

          <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-black text-gray-900">{status.steps.toLocaleString()}</span>
              <span className="text-gray-500 font-bold mb-1">steps</span>
          </div>

          <div className="mb-2 flex justify-between items-center text-xs text-gray-500 font-medium">
             <span>Progress</span>
             <span>{Math.round((status.steps / 5000) * 100)}%</span>
          </div>

          <div className="relative mb-4">
            <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-gray-100">
                <div style={{ width: `${(status.steps / 5000) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-400 rounded-full"></div>
            </div>
          </div>
          
          <p className="text-gray-500 text-sm font-medium">
             {(5000 - status.steps).toLocaleString()} steps to go!
          </p>
      </div>

      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95 mt-4">
          <RefreshCw size={20} /> Refresh Data
      </button>

    </div>
  );
};