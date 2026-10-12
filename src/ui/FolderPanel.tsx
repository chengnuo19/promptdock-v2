import { Check, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { deleteFolder } from '../domain/promptLogic';
import type { PromptDockStateV2, PromptTemplate } from '../types';

type FolderPanelProps = {
  state: PromptDockStateV2;
  prompts: PromptTemplate[];
  onChange: (state: PromptDockStateV2, message: string) => void;
  onOpen: (folderId: string, name: string) => void;
};

export const FolderPanel = ({ state, prompts, onChange, onOpen }: FolderPanelProps) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');

  const addFolder = () => {
    const name = newName.trim();
    if (!name || state.folders.some(folder => folder.name === name)) return;
    const now = Date.now();
    onChange({
      ...state,
      folders: [...state.folders, { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now }],
    }, '文件夹已创建。');
    setNewName('');
  };

  const renameFolder = (id: string) => {
    const name = editingName.trim();
    if (!name || state.folders.some(folder => folder.id !== id && folder.name === name)) return;
    onChange({
      ...state,
      folders: state.folders.map(folder => folder.id === id
        ? { ...folder, name, updatedAt: Date.now() }
        : folder),
    }, '文件夹已重命名。');
    setEditingId('');
  };

  const removeFolder = (id: string, name: string) => {
    if (!window.confirm(`删除文件夹“${name}”？其中的提示词将移到“未分类”。`)) return;
    onChange(deleteFolder(state, id), '文件夹已删除，其中的提示词已移到未分类。');
  };

  return (
    <section className="pd-section" aria-labelledby="folder-title">
      <div className="pd-section-header">
        <div><h2 id="folder-title">文件夹</h2><p>只使用一级文件夹整理主分类。</p></div>
      </div>
      <div className="pd-create-row">
        <input aria-label="新文件夹名称" value={newName} onChange={event => setNewName(event.target.value)} placeholder="新文件夹名称" onKeyDown={event => { if (event.key === 'Enter') addFolder(); }} />
        <button className="pd-icon-button pd-icon-button-accent" type="button" onClick={addFolder} disabled={!newName.trim()} aria-label="创建文件夹"><Plus size={18} /></button>
      </div>

      <div className="pd-manage-list">
        {state.folders.map(folder => {
          const count = prompts.filter(prompt => prompt.folderId === folder.id).length;
          const editing = editingId === folder.id;
          return (
            <div className="pd-manage-row" key={folder.id}>
              <FolderOpen size={17} />
              {editing
                ? <input aria-label={`重命名 ${folder.name}`} value={editingName} onChange={event => setEditingName(event.target.value)} autoFocus />
                : <button className="pd-manage-main" type="button" onClick={() => onOpen(folder.id, folder.name)}><strong>{folder.name}</strong><span>{count} 条</span></button>}
              <div className="pd-inline-actions">
                {editing ? (
                  <>
                    <button className="pd-icon-button" type="button" onClick={() => renameFolder(folder.id)} aria-label="保存文件夹名称"><Check size={15} /></button>
                    <button className="pd-icon-button" type="button" onClick={() => setEditingId('')} aria-label="取消重命名"><X size={15} /></button>
                  </>
                ) : (
                  <>
                    <button className="pd-icon-button" type="button" onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }} aria-label={`重命名 ${folder.name}`}><Pencil size={15} /></button>
                    <button className="pd-icon-button pd-danger-action" type="button" onClick={() => removeFolder(folder.id, folder.name)} aria-label={`删除 ${folder.name}`}><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

