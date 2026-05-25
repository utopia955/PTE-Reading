import React, { useState, useEffect } from "react";
import { MasteryStatus } from "../types";
import { X, Award, Check } from "lucide-react";

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: MasteryStatus;
  note: string;
  onSave: (status: MasteryStatus, note: string) => void;
}

export default function NotesModal({ isOpen, onClose, status, note, onSave }: NotesModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<MasteryStatus>(status);
  const [userNote, setUserNote] = useState(note);

  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(status);
      setUserNote(note);
    }
  }, [isOpen, status, note]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-left">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h4 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Mastery Status & Review Notes</span>
          </h4>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-750 dark:text-slate-300 block mb-2">
              Select Mastery Level for this analysis:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as MasteryStatus)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-blue-605 transition-all font-bold cursor-pointer"
            >
              <option value="needs-review">🟠 Needs Review (Mistakes made / Hard)</option>
              <option value="mastered">🟢 Mastered (100% correct / No mistakes)</option>
              <option value="critical">🔴 Critical Core (Very tricky / Contains essential keys)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-750 dark:text-slate-300 block mb-2">
              Personal Study Notes & Rules:
            </label>
            <textarea
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="e.g., Don't forget that 'adapt' takes the preposition 'to' here. Remember to focus on the key transitive action..."
              className="w-full bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-blue-605 transition-all min-h-[120px] leading-relaxed resize-none placeholder-slate-450 dark:placeholder-slate-600"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(selectedStatus, userNote)}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-600/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
