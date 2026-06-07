/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Room, Language } from '../types';
import { translations } from '../translations';
import { Plus, Home, Trash2, Edit2, X, ChevronUp, ChevronDown } from 'lucide-react';

interface RoomManagerProps {
  lang: Language;
  rooms: Room[];
  onAddRoom: (room: Room) => void;
  onUpdateRoom: (room: Room) => void;
  onDeleteRoom: (id: string) => void;
  onUpdateAllRooms: (rooms: Room[]) => void;
}

export default function RoomManager({
  lang,
  rooms,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  onUpdateAllRooms
}: RoomManagerProps) {
  const t = translations[lang];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(15);

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setName('');
    setCapacity(15);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setName(room.name);
    setCapacity(room.capacity);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(lang === 'pt' ? 'Por favor, indique um nome ou número para a sala.' : 'Please enter a room name or number.');
      return;
    }

    // Check for duplicate names (trimmed, case-insensitive)
    const normalizedName = name.trim().toLowerCase();
    const isDuplicate = rooms.some(r => 
      r.name.trim().toLowerCase() === normalizedName && 
      (!editingRoom || r.id !== editingRoom.id)
    );

    if (isDuplicate) {
      setError(t.roomDuplicateAlert || 'Já existe uma sala com esta identificação!');
      return;
    }

    if (editingRoom) {
      onUpdateRoom({
        ...editingRoom,
        name: name.trim(),
        capacity: Number(capacity)
      });
    } else {
      const maxPriority = rooms.length > 0 ? Math.max(...rooms.map(r => r.priority)) : 0;
      onAddRoom({
        id: `r_${Date.now()}`,
        name: name.trim(),
        capacity: Number(capacity),
        priority: maxPriority + 1
      });
    }
    setIsModalOpen(false);
  };

  const moveRoom = (index: number, direction: 'up' | 'down') => {
    const sortedRooms = [...rooms].sort((a, b) => a.priority - b.priority);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= sortedRooms.length) return;
    
    // Swap rooms in the sorted array
    const newRooms = [...sortedRooms];
    [newRooms[index], newRooms[targetIndex]] = [newRooms[targetIndex], newRooms[index]];
    
    // Re-assign priorities based on new order to ensure consistency
    const updatedRooms = newRooms.map((room, idx) => ({
      ...room,
      priority: idx + 1
    }));
    
    onUpdateAllRooms(updatedRooms);
  };

  const sortedRoomsList = [...rooms].sort((a, b) => a.priority - b.priority);

  return (
    <div id="room_manager" className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.roomTitle}</h2>
          <p className="text-slate-500 text-xs">{t.roomSubtitle}</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t.addRoom}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedRoomsList.length > 0 ? (
          sortedRoomsList.map((room, index) => (
            <div 
              key={room.id} 
              className="bg-white border border-slate-200 shadow-sm hover:shadow transition rounded-xl p-5 relative overflow-hidden group"
            >
              {/* Nice ambient ceiling tab accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />

              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Home className="h-4 w-4 text-slate-400" />
                    <span className="font-bold text-slate-900 text-sm">{room.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Prioridade: {room.priority}
                  </div>
                </div>
                <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => handleOpenEdit(room)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded transition cursor-pointer"
                      title={lang === 'pt' ? 'Editar Sala' : 'Edit Room'}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => onDeleteRoom(room.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded transition cursor-pointer"
                      title={lang === 'pt' ? 'Eliminar Sala' : 'Delete Room'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex space-x-1 justify-end">
                    <button 
                      disabled={index === 0}
                      onClick={() => moveRoom(index, 'up')}
                      className={`p-1 rounded transition cursor-pointer ${index === 0 ? 'text-slate-200' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
                      title={lang === 'pt' ? 'Mover para Cima' : 'Move Up'}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      disabled={index === rooms.length - 1}
                      onClick={() => moveRoom(index, 'down')}
                      className={`p-1 rounded transition cursor-pointer ${index === rooms.length - 1 ? 'text-slate-200' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
                      title={lang === 'pt' ? 'Mover para Baixo' : 'Move Down'}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>{t.capacity}:</span>
                <span className="bg-blue-50 text-blue-800 font-mono text-[11px] px-2.5 py-0.5 rounded-lg font-bold border border-blue-100">
                  {room.capacity} {lang === 'pt' ? 'Alunos' : 'Students'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-slate-50 border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-xs">
            {t.noRooms}
          </div>
        )}
      </div>

      {/* Add / Edit Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingRoom ? t.editRoom : t.addRoom}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-rose-600 rounded-full shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {t.roomName} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="ex. Sala 12, Anfiteatro B"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {t.capacity}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
