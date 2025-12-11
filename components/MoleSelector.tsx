import React, { useState, useEffect } from 'react';
import { MoleProfile } from '../types';
import { storageService } from '../services/storageService';
import { PlusCircle, Target, User } from 'lucide-react';

interface MoleSelectorProps {
  selectedMoleId: string | undefined;
  onSelect: (id: string) => void;
}

export const MoleSelector: React.FC<MoleSelectorProps> = ({ selectedMoleId, onSelect }) => {
  const [moles, setMoles] = useState<MoleProfile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");

  useEffect(() => {
    setMoles(storageService.getMoles());
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const mole = storageService.saveMole(newName, newLocation);
    setMoles(storageService.getMoles());
    onSelect(mole.id);
    setIsCreating(false);
    setNewName("");
    setNewLocation("");
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
        <Target className="w-4 h-4 text-[#DC143C]" />
        Select Mole to Track
      </h3>
      
      {!isCreating ? (
        <div className="space-y-3">
          {moles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {moles.map(mole => (
                <button
                  key={mole.id}
                  onClick={() => onSelect(mole.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedMoleId === mole.id 
                      ? 'border-[#DC143C] bg-red-50 text-red-900 ring-1 ring-[#DC143C]' 
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-full ${selectedMoleId === mole.id ? 'bg-white' : 'bg-slate-100'}`}>
                    <User className={`w-4 h-4 ${selectedMoleId === mole.id ? 'text-[#DC143C]' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{mole.name}</div>
                    <div className="text-xs opacity-70">{mole.location || "No location set"}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No saved mole profiles yet.</p>
          )}

          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 p-3 mt-2 border border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-[#DC143C] hover:border-[#DC143C] transition-colors text-sm font-medium"
          >
            <PlusCircle className="w-4 h-4" />
            Add New Mole Profile
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">New Mole Profile</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name / Identifier (e.g., Left Forearm)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#DC143C] outline-none"
                placeholder="Ex: Upper Back Mole"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Body Location (Optional)</label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#DC143C] outline-none"
                placeholder="Ex: Left Shoulder"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 bg-[#DC143C] text-white py-2 rounded-md text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                Save Profile
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};