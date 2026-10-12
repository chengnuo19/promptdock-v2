import { Download, FileUp, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createBackupJson, mergeImportedState, parseBackupJson } from '../domain/backup';
import { BUILTIN_PROMPTS } from '../domain/builtinPrompts';
import { normalizeState } from '../domain/state';
import { loadAnswerBookmarks, loadNotionConfig, loadNotionSecret, saveNotionConfig } from '../storage';
import type { NotionConfig, PromptDockBackup, PromptDockStateV2 } from '../types';

type SettingsPanelProps = {
  state: PromptDockStateV2;
  onChange: (state: PromptDockStateV2, message: string) => void;
  onRestoreBuiltin: (id: string) => void;
  onRestoreBuiltins: () => void;
};

export const SettingsPanel = ({ state, onChange, onRestoreBuiltin, onRestoreBuiltins }: SettingsPanelProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<PromptDockBackup | null>(null);
  const [error, setError] = useState('');
  const [notion, setNotion] = useState<NotionConfig>({ directories: [] });
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [directoryName, setDirectoryName] = useState('');
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [notionStatus, setNotionStatus] = useState('');

  const sendNotion = <T,>(message: Record<string, unknown>) => new Promise<T>((resolve, reject) => {
    if (!chrome.runtime?.sendMessage) return reject(new Error('后台 service worker 不可用。'));
    chrome.runtime.sendMessage(message, (response: { ok?: boolean; value?: T; error?: string } | undefined) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!response?.ok) reject(new Error(response?.error || 'Notion 请求失败。'));
      else resolve(response.value as T);
    });
  });

  useEffect(() => {
    void Promise.all([loadNotionConfig(), loadNotionSecret()]).then(([config, secret]) => { setNotion(config); setHasToken(Boolean(secret)); });
  }, []);

  const saveToken = async () => {
    try { await sendNotion({ type: 'notion:save-secret', token }); setToken(''); setHasToken(true); setNotionStatus('令牌已保存。'); }
    catch (reason) { setNotionStatus(reason instanceof Error ? reason.message : '保存令牌失败。'); }
  };
  const validateDirectory = async () => {
    try {
      const directory = await sendNotion<{ id: string; name: string; databaseUrl: string; dataSourceId: string; titleProperty: string }>({ type: 'notion:validate-directory', name: directoryName, databaseUrl });
      setNotion(config => ({ directories: [...config.directories, directory] })); setDirectoryName(''); setDatabaseUrl(''); setNotionStatus('目录已验证并保存。');
    } catch (reason) { setNotionStatus(reason instanceof Error ? reason.message : '目录验证失败。'); }
  };
  const renameDirectory = async (id: string, name: string) => {
    const next = { directories: notion.directories.map(directory => directory.id === id ? { ...directory, name } : directory) };
    await saveNotionConfig(next); setNotion(next);
  };
  const deleteDirectory = async (id: string) => {
    const bookmarks = await loadAnswerBookmarks();
    if (Object.values(bookmarks.conversations).some(conversation => conversation.notionDirectoryId === id)) { setNotionStatus('已有对话绑定此目录，不能删除；可仅重命名。'); return; }
    const next = { directories: notion.directories.filter(directory => directory.id !== id) };
    await saveNotionConfig(next); setNotion(next);
  };

  const downloadBackup = () => {
    const blob = new Blob([createBackupJson(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `promptdock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const readBackup = async (file: File) => {
    try {
      setCandidate(parseBackupJson(await file.text()));
      setError('');
    } catch (reason) {
      setCandidate(null);
      setError(reason instanceof Error ? reason.message : '读取备份失败。');
    }
  };

  const applyMerge = () => {
    if (!candidate) return;
    onChange(mergeImportedState(state, candidate.data), '备份已合并。');
    setCandidate(null);
  };

  const applyReplace = () => {
    if (!candidate || !window.confirm('整体替换会移除当前未包含在备份中的数据，确定继续吗？')) return;
    onChange(normalizeState(candidate.data), '备份已完整恢复。');
    setCandidate(null);
  };

  return (
    <section className="pd-section" aria-labelledby="settings-title">
      <div className="pd-section-header"><div><h2 id="settings-title">设置与备份</h2><p>所有数据仅保存在本机浏览器中。</p></div></div>

      <div className="pd-settings-card">
        <div className="pd-settings-icon"><ShieldCheck size={20} /></div>
        <div><strong>本机优先</strong><span>无账号、无遥测；提示词只存本机，仅在你主动同步时才访问 Notion。</span></div>
      </div>

      <div className="pd-settings-actions">
        <button className="pd-button pd-button-secondary" type="button" onClick={downloadBackup}><Download size={16} /> 导出 JSON</button>
        <button className="pd-button pd-button-secondary" type="button" onClick={() => inputRef.current?.click()}><FileUp size={16} /> 导入 JSON</button>
        <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={event => {
          const file = event.target.files?.[0];
          if (file) void readBackup(file);
          event.target.value = '';
        }} />
      </div>

      {candidate && (
        <div className="pd-import-card" role="status">
          <strong>备份可用</strong>
          <span>{candidate.data.userPrompts.length} 条个人提示词 · {candidate.data.folders.length} 个文件夹 · 导出于 {candidate.exportedAt || '未知时间'}</span>
          <div className="pd-action-row">
            <button className="pd-button pd-button-primary" type="button" onClick={applyMerge}>合并</button>
            <button className="pd-button pd-button-secondary" type="button" onClick={applyReplace}>整体替换</button>
            <button className="pd-button pd-button-quiet" type="button" onClick={() => setCandidate(null)}>取消</button>
          </div>
        </div>
      )}
      {error && <p className="pd-status pd-status-error" role="alert">{error}</p>}

      <div className="pd-divider" />
      <div className="pd-section-header"><div><h2>Notion 同步</h2><p>令牌仅保存在本机扩展存储，不会导出到提示词备份。</p></div></div>
      <div className="pd-settings-card"><div className="pd-settings-icon"><ShieldCheck size={20} /></div><div><strong>内部集成令牌</strong><span>{hasToken ? '已保存（已掩码）' : '尚未保存'}</span></div></div>
      <label className="pd-field"><span>更新令牌</span><input type="password" autoComplete="off" value={token} placeholder={hasToken ? '留空可保持当前令牌' : 'secret_…'} onChange={event => setToken(event.target.value)} /></label>
      <div className="pd-action-row"><button className="pd-button pd-button-secondary" type="button" disabled={!token.trim()} onClick={() => void saveToken()}>保存令牌</button><button className="pd-button pd-button-quiet" type="button" onClick={() => void sendNotion({ type: 'notion:test' }).then(() => setNotionStatus('连接成功。')).catch(reason => setNotionStatus(reason instanceof Error ? reason.message : '连接失败。'))}>测试连接</button><button className="pd-button pd-button-quiet" type="button" disabled={!hasToken} onClick={() => void sendNotion({ type: 'notion:clear-secret' }).then(() => { setHasToken(false); setNotionStatus('令牌已清除。'); })}>清除</button></div>
      <div className="pd-create-row"><input value={directoryName} placeholder="目录名称" onChange={event => setDirectoryName(event.target.value)} /><input value={databaseUrl} placeholder="Notion 数据库链接" onChange={event => setDatabaseUrl(event.target.value)} /></div>
      <button className="pd-button pd-button-secondary" type="button" disabled={!directoryName.trim() || !databaseUrl.trim()} onClick={() => void validateDirectory()}>验证并添加目录</button>
      {notion.directories.map(directory => <div className="pd-manage-row" key={directory.id}><ShieldCheck size={16} /><input aria-label={`目录名称 ${directory.name}`} value={directory.name} onChange={event => void renameDirectory(directory.id, event.target.value)} /><button className="pd-icon-button pd-danger-action" type="button" aria-label={`删除目录 ${directory.name}`} onClick={() => void deleteDirectory(directory.id)}>×</button></div>)}
      {notionStatus && <p className="pd-status">{notionStatus}</p>}
      <div className="pd-divider" />
      {state.hiddenBuiltinIds.length > 0 && (
        <div className="pd-hidden-builtins">
          <strong>已隐藏的内置提示词</strong>
          {state.hiddenBuiltinIds.map(id => {
            const prompt = BUILTIN_PROMPTS.find(item => item.id === id);
            return (
              <button className="pd-button pd-button-quiet pd-full" type="button" key={id} onClick={() => onRestoreBuiltin(id)}>
                <RotateCcw size={15} /> 恢复「{prompt?.title ?? id}」
              </button>
            );
          })}
        </div>
      )}
      <button className="pd-button pd-button-secondary pd-full" type="button" onClick={onRestoreBuiltins}>
        <RotateCcw size={16} /> 恢复全部内置提示词
      </button>
      <p className="pd-help">会清除内置模板的修改和隐藏状态，不影响个人提示词。</p>
    </section>
  );
};
