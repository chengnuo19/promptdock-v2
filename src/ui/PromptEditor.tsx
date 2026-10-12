import { Save, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { extractVariables, parseTags } from '../domain/promptLogic';
import type { PromptFolder, PromptTemplate } from '../types';

type PromptEditorProps = {
  prompt: PromptTemplate;
  folders: PromptFolder[];
  onSave: (prompt: PromptTemplate) => void;
  onCancel: () => void;
};

export const PromptEditor = ({ prompt, folders, onSave, onCancel }: PromptEditorProps) => {
  const [title, setTitle] = useState(prompt.title);
  const [content, setContent] = useState(prompt.content);
  const [folderId, setFolderId] = useState(prompt.folderId);
  const [tagsText, setTagsText] = useState(prompt.tags.join('，'));
  const variables = useMemo(() => extractVariables(content), [content]);
  const canSave = Boolean(title.trim() && content.trim());

  return (
    <section className="pd-editor" aria-labelledby="prompt-editor-title">
      <div className="pd-section-header">
        <div>
          <h2 id="prompt-editor-title">{prompt.source === 'builtin' ? '编辑内置提示词' : prompt.createdAt ? '编辑提示词' : '新建提示词'}</h2>
          <p>使用双花括号创建变量，例如 {'{{主题}}'}；写成 {'{{语言:中文}}'} 可给出默认值。</p>
        </div>
        <button className="pd-icon-button" type="button" onClick={onCancel} aria-label="关闭编辑器">
          <X size={17} />
        </button>
      </div>

      <label className="pd-field">
        <span>标题</span>
        <input value={title} onChange={event => setTitle(event.target.value)} autoFocus />
      </label>
      <label className="pd-field">
        <span>提示词正文</span>
        <textarea value={content} onChange={event => setContent(event.target.value)} rows={12} />
      </label>
      <div className="pd-field-grid">
        <label className="pd-field">
          <span>文件夹</span>
          <select value={folderId} onChange={event => setFolderId(event.target.value)}>
            <option value="">未分类</option>
            {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>
        <label className="pd-field">
          <span>标签</span>
          <input value={tagsText} onChange={event => setTagsText(event.target.value)} placeholder="逗号或空格分隔" />
        </label>
      </div>

      <div className="pd-variable-preview" aria-label="已识别变量">
        <span>变量</span>
        {variables.length
          ? variables.map(variable => <code key={variable.name}>{`{{${variable.name}}}`}{variable.defaultValue && <small>＝{variable.defaultValue}</small>}</code>)
          : <small>尚未识别到变量</small>}
      </div>

      <div className="pd-editor-actions">
        <button className="pd-button pd-button-secondary" type="button" onClick={onCancel}>取消</button>
        <button
          className="pd-button pd-button-primary"
          type="button"
          disabled={!canSave}
          onClick={() => onSave({
            ...prompt,
            title: title.trim(),
            content: content.trim(),
            folderId,
            tags: parseTags(tagsText),
          })}
        >
          <Save size={16} /> 保存
        </button>
      </div>
    </section>
  );
};

