import { Tag } from 'lucide-react';
import type { PromptTemplate } from '../types';

export const TagPanel = ({ prompts, onOpen }: { prompts: PromptTemplate[]; onOpen: (tag: string) => void }) => {
  const tags = [...new Set(prompts.flatMap(prompt => prompt.tags))]
    .map(tag => ({ tag, count: prompts.filter(prompt => prompt.tags.includes(tag)).length }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'));

  return (
    <section className="pd-section" aria-labelledby="tag-title">
      <div className="pd-section-header"><div><h2 id="tag-title">标签</h2><p>点击标签查看跨文件夹的提示词。</p></div></div>
      <div className="pd-tag-cloud">
        {tags.map(({ tag, count }) => (
          <button type="button" key={tag} onClick={() => onOpen(tag)}>
            <Tag size={14} /><span>{tag}</span><small>{count}</small>
          </button>
        ))}
      </div>
      {!tags.length && <div className="pd-empty"><strong>还没有标签</strong><span>编辑提示词时可添加多个标签。</span></div>}
    </section>
  );
};

