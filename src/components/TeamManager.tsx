import { useState } from 'react';
import type { TeamMember } from '../lib/storageService';
import { saveTeamMember, updateTeamMember, deleteTeamMember } from '../lib/storageService';

interface TeamManagerProps {
  members: TeamMember[];
  onUpdate: () => void;
  onClose: () => void;
}

export default function TeamManager({ members, onUpdate, onClose }: TeamManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [context, setContext] = useState('');

  const resetForm = () => {
    setName('');
    setRole('');
    setContext('');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setName(member.name);
    setRole(member.role);
    setContext(member.context);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (editingId) {
      updateTeamMember(editingId, { name, role, context });
    } else {
      saveTeamMember({ name, role, context });
    }

    resetForm();
    onUpdate();
  };

  const handleDelete = (id: string) => {
    if (confirm('Remove this team member?')) {
      deleteTeamMember(id);
      onUpdate();
    }
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
  };

  return (
    <div className="fixed inset-0 bg-boon-text/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-boon-bg p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-boon-text">My Team</h2>
              <p className="text-sm text-gray-500 mt-1">Add team members for more personalized practice</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Add/Edit Form */}
          {(isAdding || editingId) && (
            <div className="bg-boon-bg rounded-xl p-4 mb-4">
              <h3 className="text-sm font-bold text-boon-text uppercase tracking-wide mb-3">
                {editingId ? 'Edit Team Member' : 'Add Team Member'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah"
                    className="w-full mt-1 p-3 rounded-xl border border-gray-200 focus:border-boon-blue focus:ring-0 focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Designer"
                    className="w-full mt-1 p-3 rounded-xl border border-gray-200 focus:border-boon-blue focus:ring-0 focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Context & Style</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g. High performer, but struggles with public speaking. Responds well to direct feedback."
                    rows={3}
                    className="w-full mt-1 p-3 rounded-xl border border-gray-200 focus:border-boon-blue focus:ring-0 focus:outline-none text-sm resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={resetForm}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!name.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-boon-blue text-white font-bold text-sm hover:bg-boon-darkBlue transition-colors disabled:opacity-50"
                  >
                    {editingId ? 'Save Changes' : 'Save Member'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Team List */}
          {members.length === 0 && !isAdding ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-boon-lightBlue rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm mb-4">No team members yet</p>
              <button
                onClick={startAdding}
                className="px-4 py-2 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-colors"
              >
                Add Your First Team Member
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    editingId === member.id
                      ? 'border-boon-blue bg-boon-lightBlue/20'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-boon-text">{member.name}</span>
                        {member.role && (
                          <span className="text-xs text-gray-400">• {member.role}</span>
                        )}
                      </div>
                      {member.context && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{member.context}</p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-1.5 text-gray-400 hover:text-boon-blue hover:bg-boon-lightBlue/50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {members.length > 0 && !isAdding && !editingId && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={startAdding}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 font-bold text-sm hover:border-boon-blue hover:text-boon-blue hover:bg-boon-lightBlue/20 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Team Member
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
